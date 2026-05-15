"""Quick sanity checks after ingesting the crimes table."""
import psycopg

from app.config import get_settings


def main() -> None:
    db_url = get_settings().database_url.replace("postgresql+psycopg://", "postgresql://")

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        queries = [
            ("Total rows", "SELECT count(*) FROM crimes"),
            ("Rows with lat/lng", "SELECT count(*) FROM crimes WHERE latitude IS NOT NULL"),
            ("Rows with arrest=true", "SELECT count(*) FROM crimes WHERE arrest = true"),
            ("Rows with domestic=true", "SELECT count(*) FROM crimes WHERE domestic = true"),
            ("Distinct years", "SELECT count(DISTINCT year) FROM crimes"),
            ("Min year", "SELECT min(year) FROM crimes"),
            ("Max year", "SELECT max(year) FROM crimes"),
            ("Distinct primary_type", "SELECT count(DISTINCT primary_type) FROM crimes"),
        ]
        for label, sql in queries:
            cur.execute(sql)
            value = cur.fetchone()[0]
            if isinstance(value, int):
                print(f"{label:<30} {value:>15,}")
            else:
                print(f"{label:<30} {value}")

        print("\nTop 10 primary types:")
        cur.execute("""
            SELECT primary_type, count(*) AS n
            FROM crimes
            WHERE primary_type IS NOT NULL
            GROUP BY primary_type
            ORDER BY n DESC
            LIMIT 10
        """)
        for ptype, n in cur.fetchall():
            print(f"  {ptype:<40} {n:>10,}")

        print("\nRow counts by year (last 10 years):")
        cur.execute("""
            SELECT year, count(*) AS n
            FROM crimes
            WHERE year IS NOT NULL
            GROUP BY year
            ORDER BY year DESC
            LIMIT 10
        """)
        for yr, n in cur.fetchall():
            print(f"  {yr}: {n:>10,}")


if __name__ == "__main__":
    main()