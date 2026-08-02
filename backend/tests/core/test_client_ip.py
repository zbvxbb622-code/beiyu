from app.core.client_ip import client_ip_from_headers


def test_untrusted_proxy_headers_are_ignored() -> None:
    assert (
        client_ip_from_headers(
            peer_host="127.0.0.1",
            forwarded_for="203.0.113.10, 127.0.0.1",
            trusted_proxy_hosts=(),
        )
        == "127.0.0.1"
    )


def test_trusted_proxy_uses_leftmost_valid_forwarded_client() -> None:
    assert (
        client_ip_from_headers(
            peer_host="127.0.0.1",
            forwarded_for="203.0.113.10, 10.0.0.2",
            trusted_proxy_hosts=("127.0.0.1",),
        )
        == "203.0.113.10"
    )


def test_malformed_forwarded_chain_falls_back_to_peer_host() -> None:
    assert (
        client_ip_from_headers(
            peer_host="127.0.0.1",
            forwarded_for="not an ip, 203.0.113.10",
            trusted_proxy_hosts=("127.0.0.1",),
        )
        == "127.0.0.1"
    )
