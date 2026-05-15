"""Ingest the Chicago crime CSV into Postgres."""
from __future__ import annotations

import argparse
import csv
import io
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

import psycopg

from app.config import get_settings


DB_COLUMNS = [
    "id", "city_id", "source_id", "case_number", "occurred_at",
    "block", "iucr", "primary_type", "description", "location_description",
    "arrest", "domestic", "beat", "district", "ward", "community_area",
    "fbi_code", "year", "updated_on", "latitude", "longitude",
]


def parse_date(value: str) -> Optional[str]:
    if not value:
        return None
    try:
        dt = datetime.strptime(value, "%m/%d/%Y %I:%M:%S %p")
        return dt.isoformat(sep=" ")
    except ValueError:
        return None


def parse_bool(value: str) -> Optional[str]:
    if not value:
        return None
    v = value.strip().lower()
    if v in ("true", "t", "1", "yes", "y"):
        return "t"
    if v in ("false", "f", "0", "no", "n"):
        return "f"
    return None


def parse_int(value: str) -> Optional[str]:
    if not value or not value.strip():
        return None
    try:
        return str(int(float(value)))
    except (ValueError, TypeError):
        return None


def parse_float(value: str) -> Optional[str]:
    if not value or not value.strip():
        return None
    try:
        return str(float(value))
    except (ValueError, TypeError):
        return None


def clean(value: str) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    return v if v else None


def get_city_id(conn: psycopg.Connection, slug: str) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM cities WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"City with slug '{slug}' not found. Seed it first.")
        return row[0]


def row_to_record(row: dict, city_id: uuid.UUID) -> Optional[list]:
    try:
        record = [
            str(uuid.uuid4()),
            str(city_id),
            clean(row.get("ID", "")),
            clean(row.get("Case Number", "")),
            parse_date(row.get("Date", "")),
            clean(row.get("Block", "")),
            clean(row.get("IUCR", "")),
            clean(row.get("Primary Type", "")),
            clean(row.get("Description", "")),
            clean(row.get("Location Description", "")),
            parse_bool(row.get("Arrest", "")),
            parse_bool(row.get("Domestic", "")),
            clean(row.get("Beat", "")),
            clean(row.get("District", "")),
            parse_int(row.get("Ward", "")),
            parse_int(row.get("Community Area", "")),
            clean(row.get("FBI Code", "")),
            parse_int(row.get("Year", "")),
            parse_date(row.get("Updated On", "")),
            parse_float(row.get("Latitude", "")),
            parse_float(row.get("Longitude", "")),
        ]
        if not record[2]:
            return None
        return record
    except Exception:
        return None


def stream_records(csv_path: Path, city_id: uuid.UUID) -> Iterator[list]:
    with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            record = row_to_record(row, city_id)
            if record is not None:
                yield record


def records_to_tsv_buffer(records: list) -> io.StringIO:
    buf = io.StringIO()
    writer = csv.writer(
        buf,
        delimiter="\t",
        quoting=csv.QUOTE_MINIMAL,
        escapechar="\\",
        lineterminator="\n",
    )
    for record in records:
        writer.writerow(["\\N" if v is None else v for v in record])
    buf.seek(0)
    return buf


def ingest(csv_path: Path, batch_size: int = 50_000, city_slug: str = "chicago") -> None:
    settings = get_settings()
    db_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")

    print(f"Connecting to database...")
    with psycopg.connect(db_url) as conn:
        city_id = get_city_id(conn, city_slug)
        print(f"Found city '{city_slug}': {city_id}")

        print(f"Streaming {csv_path}...")
        start = time.time()
        total_rows = 0
        batch: list = []

        with conn.cursor() as cur:
            copy_sql = f"""
                COPY crimes ({', '.join(DB_COLUMNS)})
                FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\\\N')
            """

            for record in stream_records(csv_path, city_id):
                batch.append(record)
                if len(batch) >= batch_size:
                    buf = records_to_tsv_buffer(batch)
                    with cur.copy(copy_sql) as copy:
                        copy.write(buf.getvalue())
                    total_rows += len(batch)
                    batch = []
                    elapsed = time.time() - start
                    rate = total_rows / elapsed if elapsed > 0 else 0
                    print(
                        f"  Ingested {total_rows:>10,} rows  "
                        f"({rate:>8,.0f} rows/sec, elapsed {elapsed:.1f}s)"
                    )

            if batch:
                buf = records_to_tsv_buffer(batch)
                with cur.copy(copy_sql) as copy:
                    copy.write(buf.getvalue())
                total_rows += len(batch)

            conn.commit()

        elapsed = time.time() - start
        print(f"\nDone. Ingested {total_rows:,} rows in {elapsed:.1f}s "
              f"({total_rows / elapsed:,.0f} rows/sec)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Chicago crime CSV into Postgres.")
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=50_000)
    parser.add_argument("--city", type=str, default="chicago")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"ERROR: CSV not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    ingest(args.csv, batch_size=args.batch_size, city_slug=args.city)


if __name__ == "__main__":
    main()