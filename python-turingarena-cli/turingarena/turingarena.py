#!/usr/bin/env python3
# TuringArena CLI in python

import argparse
import json

from gql import Client

from turingarena.contest import Contest
from turingarena.graphql import GraphQlClient

DEFAULT_SERVER = "http://localhost:8080"

parser = argparse.ArgumentParser(description="TuringArena CLI client")
parser.add_argument("-s", "--server", help="address of TuringArena", default=DEFAULT_SERVER)

subparsers = parser.add_subparsers(dest="command", description="command to run")
subparsers.required = True

init_db_parser = subparsers.add_parser("init-db", help="initialize the database")

show_parser = subparsers.add_parser("show", help="show current contest")

import_parser = subparsers.add_parser("import", help="import a contest")
import_parser.add_argument("-p", "--path", help="path of the contest to import", default=".")
import_parser.add_argument("-f", "--fresh", help="reimport the contest from scratch", default=False)

export_parser = subparsers.add_parser("export", help="export a contest")
export_parser.add_argument("-p", "--path", help="path where to export to", default=".")
export_parser.add_argument("-s", "--submissions", help="also export the submissions", default=".")

convert_parser = subparsers.add_parser("convert", help="convert a ItalyYAML contest to a TuringArena contest")
convert_parser.add_argument("-p", "--path", help="path of the contest to convert", default=".")


class TuringArena:
    client: GraphQlClient
    args: argparse.Namespace

    def __init__(self):
        self.args = parser.parse_args()
        self.client = GraphQlClient(self.args.server)

    def run_init_db(self):
        print(self.client.init_db())

    def run_import(self):
        contest = Contest.from_directory(self.args.path)
        print(self.client.create_contest(dict(
            contest=contest.to_graphql(),
            problems=list(map(lambda p: p.to_graphql(), contest.problems)),
            users=list(map(lambda u: u.to_graphql(), contest.users)),
        )))

    def run_show(self):
        print(self.client.show_contest())

    def run_export(args):
        pass

    def run_convert(args):
        pass

    def run(self):
        getattr(self, "run_" + self.args.command.replace("-", "_"))()


def main():
    TuringArena().run()
