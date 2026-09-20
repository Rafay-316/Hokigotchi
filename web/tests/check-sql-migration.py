"""Optional SQL regression check: install pglast, then run this file with Python."""
from pathlib import Path
import re
import unittest
from pglast import parse_sql, parse_plpgsql
from pglast.parser import ParseError

MIGRATION = Path(__file__).resolve().parents[1] / 'supabase/migrations/202609200001_hokigotchi.sql'

class MigrationSyntax(unittest.TestCase):
    def test_migration_and_function_bodies_parse(self):
        source = MIGRATION.read_text(encoding='utf-8')
        self.assertTrue(parse_sql(source))
        functions = list(re.finditer(r'create(?: or replace)? function\s+public\.(\w+)\b[\s\S]*?\$\$(.*?)\$\$;', source, re.S | re.I))
        self.assertEqual(len(functions), 3)
        for function in functions:
            with self.subTest(function=function.group(1)):
                if re.search(r'language sql\b', function.group(0), re.I):
                    parse_sql(function.group(2))
                else:
                    parse_plpgsql(function.group(0))

    def test_unquoted_output_name_reproduces_reported_error(self):
        source = MIGRATION.read_text(encoding='utf-8')
        with self.assertRaisesRegex(ParseError, 'position'):
            parse_sql(source.replace('"position" bigint', 'position bigint', 1))

if __name__ == '__main__':
    unittest.main()
