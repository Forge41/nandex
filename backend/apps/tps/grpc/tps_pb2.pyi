from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class App(_message.Message):
    __slots__ = ("id", "app_code", "app_name", "display_name", "auth_type", "category", "provider", "meta_json", "is_install_required")
    ID_FIELD_NUMBER: _ClassVar[int]
    APP_CODE_FIELD_NUMBER: _ClassVar[int]
    APP_NAME_FIELD_NUMBER: _ClassVar[int]
    DISPLAY_NAME_FIELD_NUMBER: _ClassVar[int]
    AUTH_TYPE_FIELD_NUMBER: _ClassVar[int]
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    PROVIDER_FIELD_NUMBER: _ClassVar[int]
    META_JSON_FIELD_NUMBER: _ClassVar[int]
    IS_INSTALL_REQUIRED_FIELD_NUMBER: _ClassVar[int]
    id: str
    app_code: int
    app_name: str
    display_name: str
    auth_type: str
    category: str
    provider: str
    meta_json: str
    is_install_required: bool
    def __init__(self, id: _Optional[str] = ..., app_code: _Optional[int] = ..., app_name: _Optional[str] = ..., display_name: _Optional[str] = ..., auth_type: _Optional[str] = ..., category: _Optional[str] = ..., provider: _Optional[str] = ..., meta_json: _Optional[str] = ..., is_install_required: _Optional[bool] = ...) -> None: ...

class ListAppsRequest(_message.Message):
    __slots__ = ("category",)
    CATEGORY_FIELD_NUMBER: _ClassVar[int]
    category: int
    def __init__(self, category: _Optional[int] = ...) -> None: ...

class ListAppsResponse(_message.Message):
    __slots__ = ("apps",)
    APPS_FIELD_NUMBER: _ClassVar[int]
    apps: _containers.RepeatedCompositeFieldContainer[App]
    def __init__(self, apps: _Optional[_Iterable[_Union[App, _Mapping]]] = ...) -> None: ...

class GetAppRequest(_message.Message):
    __slots__ = ("identifier",)
    IDENTIFIER_FIELD_NUMBER: _ClassVar[int]
    identifier: str
    def __init__(self, identifier: _Optional[str] = ...) -> None: ...

class InstallAppRequest(_message.Message):
    __slots__ = ("app_name", "state", "redirect_uri")
    APP_NAME_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    REDIRECT_URI_FIELD_NUMBER: _ClassVar[int]
    app_name: str
    state: str
    redirect_uri: str
    def __init__(self, app_name: _Optional[str] = ..., state: _Optional[str] = ..., redirect_uri: _Optional[str] = ...) -> None: ...

class InstallAppResponse(_message.Message):
    __slots__ = ("authorize_url",)
    AUTHORIZE_URL_FIELD_NUMBER: _ClassVar[int]
    authorize_url: str
    def __init__(self, authorize_url: _Optional[str] = ...) -> None: ...

class ExchangeCodeRequest(_message.Message):
    __slots__ = ("app_name", "project_id", "code", "redirect_uri")
    APP_NAME_FIELD_NUMBER: _ClassVar[int]
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    CODE_FIELD_NUMBER: _ClassVar[int]
    REDIRECT_URI_FIELD_NUMBER: _ClassVar[int]
    app_name: str
    project_id: str
    code: str
    redirect_uri: str
    def __init__(self, app_name: _Optional[str] = ..., project_id: _Optional[str] = ..., code: _Optional[str] = ..., redirect_uri: _Optional[str] = ...) -> None: ...

class ConnectCredentialsRequest(_message.Message):
    __slots__ = ("app_name", "project_id", "credentials_json")
    APP_NAME_FIELD_NUMBER: _ClassVar[int]
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    CREDENTIALS_JSON_FIELD_NUMBER: _ClassVar[int]
    app_name: str
    project_id: str
    credentials_json: str
    def __init__(self, app_name: _Optional[str] = ..., project_id: _Optional[str] = ..., credentials_json: _Optional[str] = ...) -> None: ...

class ConnectionSummary(_message.Message):
    __slots__ = ("id", "app_name", "identifier", "status", "created_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    APP_NAME_FIELD_NUMBER: _ClassVar[int]
    IDENTIFIER_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    app_name: str
    identifier: str
    status: str
    created_at: str
    def __init__(self, id: _Optional[str] = ..., app_name: _Optional[str] = ..., identifier: _Optional[str] = ..., status: _Optional[str] = ..., created_at: _Optional[str] = ...) -> None: ...

class ListConnectionsRequest(_message.Message):
    __slots__ = ("project_id",)
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    project_id: str
    def __init__(self, project_id: _Optional[str] = ...) -> None: ...

class ListConnectionsResponse(_message.Message):
    __slots__ = ("connections",)
    CONNECTIONS_FIELD_NUMBER: _ClassVar[int]
    connections: _containers.RepeatedCompositeFieldContainer[ConnectionSummary]
    def __init__(self, connections: _Optional[_Iterable[_Union[ConnectionSummary, _Mapping]]] = ...) -> None: ...

class GetConnectionRequest(_message.Message):
    __slots__ = ("project_id", "identifier")
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    IDENTIFIER_FIELD_NUMBER: _ClassVar[int]
    project_id: str
    identifier: str
    def __init__(self, project_id: _Optional[str] = ..., identifier: _Optional[str] = ...) -> None: ...

class GetTokenRequest(_message.Message):
    __slots__ = ("project_id", "connection_id")
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    CONNECTION_ID_FIELD_NUMBER: _ClassVar[int]
    project_id: str
    connection_id: str
    def __init__(self, project_id: _Optional[str] = ..., connection_id: _Optional[str] = ...) -> None: ...

class GetTokenResponse(_message.Message):
    __slots__ = ("access_token",)
    ACCESS_TOKEN_FIELD_NUMBER: _ClassVar[int]
    access_token: str
    def __init__(self, access_token: _Optional[str] = ...) -> None: ...

class DeleteConnectionRequest(_message.Message):
    __slots__ = ("project_id", "connection_id")
    PROJECT_ID_FIELD_NUMBER: _ClassVar[int]
    CONNECTION_ID_FIELD_NUMBER: _ClassVar[int]
    project_id: str
    connection_id: str
    def __init__(self, project_id: _Optional[str] = ..., connection_id: _Optional[str] = ...) -> None: ...

class DeleteConnectionResponse(_message.Message):
    __slots__ = ("ok",)
    OK_FIELD_NUMBER: _ClassVar[int]
    ok: bool
    def __init__(self, ok: _Optional[bool] = ...) -> None: ...
