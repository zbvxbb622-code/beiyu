from sqlmodel import Field, SQLModel


class SystemMetadata(SQLModel, table=True):
    __tablename__ = "system_metadata"

    key: str = Field(primary_key=True, max_length=100)
    value: str = Field(max_length=255)
