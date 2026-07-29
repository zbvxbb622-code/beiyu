from typing import Protocol


class SmsProvider(Protocol):
    def create_code(self) -> str: ...

    def send_code(
        self,
        *,
        phone: str,
        code: str,
        expires_minutes: int,
    ) -> None: ...
