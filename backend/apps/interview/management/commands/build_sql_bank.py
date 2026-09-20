"""Writes the SQL task bank, proving every task runs before it is written.

Each definition below carries a reference query. That query is executed against its own
schema and seed in the real sandbox, and whatever Postgres returns becomes the task's
`expected.csv`. A task whose reference query does not run is not written -- the same rule
the coding bank was imported under, for the same reason: a candidate must not be the
first person to discover a task is broken.

    uv run python manage.py build_sql_bank
"""

import csv
import datetime
import io
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.core.clients import runner_client
from apps.interview.sql_bank import BANK_DIR

CHECKS = [
    {"name": "query runs", "hidden": False},
    {"name": "result matches", "hidden": False},
]

TASKS: tuple[dict, ...] = (
    {
        "slug": "active-customers",
        "title": "Customers in one city",
        "prompt": (
            "Return the name and signup date of every customer in Bengaluru, newest "
            "first. Name the columns `name` and `signed_up`."
        ),
        "schema_sql": (
            "CREATE TABLE customers (\n"
            "  id         int PRIMARY KEY,\n"
            "  name       text NOT NULL,\n"
            "  city       text NOT NULL,\n"
            "  signed_up  date NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO customers (id, name, city, signed_up) VALUES\n"
            "  (1, 'Asha Rao',      'Bengaluru', '2024-01-14'),\n"
            "  (2, 'Vikram Shah',   'Mumbai',    '2024-02-02'),\n"
            "  (3, 'Leela Menon',   'Bengaluru', '2024-03-30'),\n"
            "  (4, 'Tarun Gupta',   'Delhi',     '2024-04-11'),\n"
            "  (5, 'Nisha Pillai',  'Bengaluru', '2023-11-05');\n"
        ),
        "starter": "-- Customers in Bengaluru, newest first.\nSELECT\nFROM customers\n",
        "solution": (
            "SELECT name, signed_up\n"
            "FROM customers\n"
            "WHERE city = 'Bengaluru'\n"
            "ORDER BY signed_up DESC;\n"
        ),
    },
    {
        "slug": "top-orders",
        "title": "The three largest orders",
        "prompt": (
            "Return the three largest orders by amount, largest first, as `id` and `amount_cents`."
        ),
        "schema_sql": (
            "CREATE TABLE orders (\n"
            "  id            int PRIMARY KEY,\n"
            "  customer_id   int NOT NULL,\n"
            "  amount_cents  int NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO orders (id, customer_id, amount_cents) VALUES\n"
            "  (1, 1,  4500),\n"
            "  (2, 2, 12000),\n"
            "  (3, 1,   900),\n"
            "  (4, 3,  8300),\n"
            "  (5, 2, 15750),\n"
            "  (6, 4,  2200);\n"
        ),
        "starter": "-- The three largest orders.\nSELECT\nFROM orders\n",
        "solution": (
            "SELECT id, amount_cents\nFROM orders\nORDER BY amount_cents DESC\nLIMIT 3;\n"
        ),
    },
    {
        "slug": "orders-per-customer",
        "title": "How many orders each customer placed",
        "prompt": (
            "Return `customer_id` and how many orders they placed as `orders`, busiest "
            "first. Break ties by `customer_id` ascending."
        ),
        "schema_sql": (
            "CREATE TABLE orders (\n"
            "  id           int PRIMARY KEY,\n"
            "  customer_id  int NOT NULL,\n"
            "  placed_on    date NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO orders (id, customer_id, placed_on) VALUES\n"
            "  (1, 1, '2024-01-02'),\n"
            "  (2, 2, '2024-01-03'),\n"
            "  (3, 1, '2024-01-09'),\n"
            "  (4, 3, '2024-02-01'),\n"
            "  (5, 1, '2024-02-14'),\n"
            "  (6, 2, '2024-03-07');\n"
        ),
        "starter": "-- Orders per customer, busiest first.\nSELECT\nFROM orders\n",
        "solution": (
            "SELECT customer_id, COUNT(*) AS orders\n"
            "FROM orders\n"
            "GROUP BY customer_id\n"
            "ORDER BY orders DESC, customer_id;\n"
        ),
    },
    {
        "slug": "revenue-by-merchant",
        "title": "Settled total per merchant",
        "prompt": (
            "For each merchant, return the total of its **settled** transfers as "
            "`merchant` and `total_cents`, ordered by merchant. Merchants with no "
            "settled transfer should not appear."
        ),
        "schema_sql": (
            "CREATE TABLE transfers (\n"
            "  id        int PRIMARY KEY,\n"
            "  merchant  text NOT NULL,\n"
            "  status    text NOT NULL,\n"
            "  cents     int NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO transfers (id, merchant, status, cents) VALUES\n"
            "  (1, 'acme',   'settled', 100),\n"
            "  (2, 'acme',   'settled', 250),\n"
            "  (3, 'acme',   'pending', 999),\n"
            "  (4, 'globex', 'settled',  80),\n"
            "  (5, 'initech','pending', 400),\n"
            "  (6, 'globex', 'failed',   70);\n"
        ),
        "starter": "-- Settled totals per merchant.\nSELECT\nFROM transfers\n",
        "solution": (
            "SELECT merchant, SUM(cents) AS total_cents\n"
            "FROM transfers\n"
            "WHERE status = 'settled'\n"
            "GROUP BY merchant\n"
            "ORDER BY merchant;\n"
        ),
    },
    {
        "slug": "join-orders-customers",
        "title": "Orders with the customer who placed them",
        "prompt": (
            "Return every order alongside the customer who placed it, as `name` and "
            "`amount_cents`, ordered by `amount_cents` descending."
        ),
        "schema_sql": (
            "CREATE TABLE customers (\n"
            "  id    int PRIMARY KEY,\n"
            "  name  text NOT NULL\n"
            ");\n\n"
            "CREATE TABLE orders (\n"
            "  id            int PRIMARY KEY,\n"
            "  customer_id   int NOT NULL REFERENCES customers(id),\n"
            "  amount_cents  int NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO customers (id, name) VALUES\n"
            "  (1, 'Asha Rao'), (2, 'Vikram Shah'), (3, 'Leela Menon');\n\n"
            "INSERT INTO orders (id, customer_id, amount_cents) VALUES\n"
            "  (1, 1, 4500),\n"
            "  (2, 2, 12000),\n"
            "  (3, 1,  900),\n"
            "  (4, 3, 8300);\n"
        ),
        "starter": "-- Each order with the customer who placed it.\nSELECT\nFROM orders\n",
        "solution": (
            "SELECT c.name, o.amount_cents\n"
            "FROM orders o\n"
            "JOIN customers c ON c.id = o.customer_id\n"
            "ORDER BY o.amount_cents DESC;\n"
        ),
    },
    {
        "slug": "customers-without-orders",
        "title": "Customers who never ordered",
        "prompt": (
            "Return the `name` of every customer who has never placed an order, alphabetically."
        ),
        "schema_sql": (
            "CREATE TABLE customers (\n"
            "  id    int PRIMARY KEY,\n"
            "  name  text NOT NULL\n"
            ");\n\n"
            "CREATE TABLE orders (\n"
            "  id           int PRIMARY KEY,\n"
            "  customer_id  int NOT NULL REFERENCES customers(id)\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO customers (id, name) VALUES\n"
            "  (1, 'Asha Rao'), (2, 'Vikram Shah'), (3, 'Leela Menon'), (4, 'Tarun Gupta');\n\n"
            "INSERT INTO orders (id, customer_id) VALUES\n"
            "  (1, 1), (2, 1), (3, 3);\n"
        ),
        "starter": "-- Customers with no orders at all.\nSELECT\nFROM customers\n",
        "solution": (
            "SELECT c.name\n"
            "FROM customers c\n"
            "LEFT JOIN orders o ON o.customer_id = c.id\n"
            "WHERE o.id IS NULL\n"
            "ORDER BY c.name;\n"
        ),
    },
    {
        "slug": "repeat-buyers",
        "title": "Customers who ordered more than once",
        "prompt": (
            "Return `customer_id` and their order count as `orders`, for customers with "
            "more than one order. Order by `customer_id`."
        ),
        "schema_sql": (
            "CREATE TABLE orders (\n"
            "  id           int PRIMARY KEY,\n"
            "  customer_id  int NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO orders (id, customer_id) VALUES\n"
            "  (1, 1), (2, 2), (3, 1), (4, 3), (5, 1), (6, 2);\n"
        ),
        "starter": "-- Customers with more than one order.\nSELECT\nFROM orders\n",
        "solution": (
            "SELECT customer_id, COUNT(*) AS orders\n"
            "FROM orders\n"
            "GROUP BY customer_id\n"
            "HAVING COUNT(*) > 1\n"
            "ORDER BY customer_id;\n"
        ),
    },
    {
        "slug": "distinct-cities",
        "title": "Every city a customer signed up from",
        "prompt": "Return each distinct `city`, alphabetically, with no repeats.",
        "schema_sql": (
            "CREATE TABLE customers (\n"
            "  id    int PRIMARY KEY,\n"
            "  name  text NOT NULL,\n"
            "  city  text NOT NULL\n"
            ");\n"
        ),
        "seed_sql": (
            "INSERT INTO customers (id, name, city) VALUES\n"
            "  (1, 'Asha Rao',     'Bengaluru'),\n"
            "  (2, 'Vikram Shah',  'Mumbai'),\n"
            "  (3, 'Leela Menon',  'Bengaluru'),\n"
            "  (4, 'Tarun Gupta',  'Delhi'),\n"
            "  (5, 'Nisha Pillai', 'Mumbai');\n"
        ),
        "starter": "-- Each city, once.\nSELECT\nFROM customers\n",
        "solution": "SELECT DISTINCT city\nFROM customers\nORDER BY city;\n",
    },
)


def _schema_shape(schema_sql: str) -> list[dict]:
    """The column list the sidebar shows, read off the DDL it is describing.

    Parsed rather than written twice: a hand-kept copy is one edit away from telling a
    candidate about a column the database does not have.
    """
    tables = []
    for block in schema_sql.split("CREATE TABLE ")[1:]:
        name, _, rest = block.partition("(")
        columns = []
        for line in rest.split(")")[0].split(","):
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0].upper() not in {"PRIMARY", "FOREIGN", "UNIQUE"}:
                columns.append({"name": parts[0], "type": parts[1].lower()})
        tables.append({"name": name.strip(), "columns": columns})
    return tables


class Command(BaseCommand):
    help = "Build the SQL task bank, running every reference query to record its result."

    def handle(self, *args, **options):
        written = 0
        for task in TASKS:
            rows = self._expected(task)
            payload = {
                "slug": task["slug"],
                # When the reference query actually ran. Carried into the row by
                # load_task_banks, so the bank can say how old its proof is rather than
                # only that one was taken once.
                "verifiedAt": datetime.datetime.now(datetime.UTC).isoformat(),
                "title": task["title"],
                "prompt": task["prompt"],
                "schema": _schema_shape(task["schema_sql"]),
                "attemptsAllowed": 3,
                "tests": CHECKS,
                "defaultLanguage": "sql",
                "languages": {
                    "sql": {
                        "tests": CHECKS,
                        "files": [
                            {"name": "query.sql", "language": "sql", "content": task["starter"]},
                            {
                                "name": "schema.sql",
                                "language": "sql",
                                "content": task["schema_sql"],
                                "hidden": True,
                            },
                            {
                                "name": "seed.sql",
                                "language": "sql",
                                "content": task["seed_sql"],
                                "hidden": True,
                            },
                            {
                                "name": "expected.csv",
                                "language": "sql",
                                "content": rows,
                                "hidden": True,
                            },
                        ],
                    }
                },
            }
            path = Path(BANK_DIR) / f"{task['slug']}.json"
            path.write_text(json.dumps(payload, indent=2) + "\n")
            written += 1
            first = next(csv.reader(io.StringIO(rows)), [])
            self.stdout.write(f"  {task['slug']:<26} {len(rows.splitlines()) - 1} rows  {first}")
        self.stdout.write(self.style.SUCCESS(f"Wrote {written} SQL tasks to {BANK_DIR}"))

    def _expected(self, task: dict) -> str:
        files = {
            "schema.sql": task["schema_sql"],
            "seed.sql": task["seed_sql"],
            "query.sql": task["solution"],
        }
        rows = None
        done = None
        for event in runner_client.run(language="sql", files=files):
            if event["event"] == "rows":
                rows = event["data"].get("csv")
            elif event["event"] == "done":
                done = event["data"]
        if done is None or done.get("phase") != "ran" or not rows:
            raise SystemExit(
                f"{task['slug']}: the reference query did not run "
                f"({(done or {}).get('phase', 'no result')})"
            )
        return rows
