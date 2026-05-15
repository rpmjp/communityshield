"""Alembic environment. Reads DATABASE_URL from app config."""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.config import get_settings
from app.db import Base

# Import all models so Alembic's autogenerate sees them.
from app import models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject the URL from settings
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


# PostGIS ships with internal tables we must not touch.
POSTGIS_OWNED_TABLES = {
    "spatial_ref_sys",
    "topology",
    "layer",
    # tiger_data / tiger_geocoder reference tables
    "addr", "addrfeat", "bg", "county", "county_lookup", "countysub_lookup",
    "cousub", "direction_lookup", "edges", "faces", "featnames",
    "geocode_settings", "geocode_settings_default", "loader_lookuptables",
    "loader_platform", "loader_variables", "pagc_gaz", "pagc_lex", "pagc_rules",
    "place", "place_lookup", "secondary_unit_lookup", "state", "state_lookup",
    "street_type_lookup", "tabblock", "tabblock20", "tract", "zcta5",
    "zip_lookup", "zip_lookup_all", "zip_lookup_base", "zip_state",
    "zip_state_loc",
}


def include_object(object, name, type_, reflected, compare_to):
    """Skip PostGIS / tiger geocoder objects so autogenerate doesn't try to drop them."""
    if type_ == "table" and name in POSTGIS_OWNED_TABLES:
        return False
    if type_ == "index" and reflected and compare_to is None:
        # Skip indexes on PostGIS-owned tables
        try:
            if object.table.name in POSTGIS_OWNED_TABLES:
                return False
        except AttributeError:
            pass
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
