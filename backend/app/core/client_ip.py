import ipaddress
from collections.abc import Sequence


def _valid_ip(value: str) -> str | None:
    candidate = value.strip()
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def client_ip_from_headers(
    *,
    peer_host: str,
    forwarded_for: str | None,
    trusted_proxy_hosts: Sequence[str],
) -> str:
    peer_ip = _valid_ip(peer_host) or "127.0.0.1"
    trusted_proxies = {_valid_ip(host) for host in trusted_proxy_hosts}
    trusted_proxies.discard(None)
    if peer_ip not in trusted_proxies or not forwarded_for:
        return peer_ip

    forwarded_chain = [part.strip() for part in forwarded_for.split(",")]
    if not forwarded_chain:
        return peer_ip
    first_forwarded = _valid_ip(forwarded_chain[0])
    return first_forwarded or peer_ip
