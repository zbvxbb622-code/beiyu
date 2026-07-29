import argparse
import sys

from sqlmodel import Session

from app.cli import promote_admin, revoke_admin
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import UserRole
from app.db.session import get_engine
from app.modules.content.seed import seed_content


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    seed_parser = commands.add_parser("seed-content")
    seed_parser.add_argument("--update-existing", action="store_true")

    promote_parser = commands.add_parser("promote-admin")
    promote_parser.add_argument("--phone", required=True)
    promote_parser.add_argument(
        "--role",
        required=True,
        choices=(UserRole.EDITOR.value, UserRole.SUPER_ADMIN.value),
    )

    revoke_parser = commands.add_parser("revoke-admin")
    revoke_parser.add_argument("--phone", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    settings = get_settings()
    with Session(get_engine()) as session:
        try:
            if args.command == "seed-content":
                result = seed_content(
                    session,
                    update_existing=args.update_existing,
                )
                sys.stdout.write(
                    f"created={result.created} updated={result.updated} "
                    f"skipped={result.skipped}\n"
                )
            elif args.command == "promote-admin":
                user = promote_admin(
                    session,
                    raw_phone=args.phone,
                    role=UserRole(args.role),
                    secret_key=settings.secret_key,
                )
                sys.stdout.write(
                    f"{user.phone_masked} role={user.role.value}\n"
                )
            else:
                user = revoke_admin(
                    session,
                    raw_phone=args.phone,
                    secret_key=settings.secret_key,
                )
                sys.stdout.write(
                    f"{user.phone_masked} role={user.role.value}\n"
                )
        except AppError as exc:
            sys.stderr.write(f"{exc.code}: {exc.message}\n")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
