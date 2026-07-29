class DevelopmentSmsProvider:
    def __init__(self, *, code: str) -> None:
        self._code = code

    def create_code(self) -> str:
        return self._code

    def send_code(
        self,
        *,
        phone: str,
        code: str,
        expires_minutes: int,
    ) -> None:
        del phone, code, expires_minutes
