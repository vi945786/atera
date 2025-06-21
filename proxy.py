import logging
import os
import re
import requests
from flask import Flask, request, Response, send_from_directory, make_response
from urllib.parse import unquote, urlparse, parse_qs

app = Flask(__name__)

app.logger.disabled = True
log = logging.getLogger('werkzeug')
log.disabled = True
import click
click.echo = lambda a: ""


def get_response(request, url):
    method = request.method
    req_headers = {key: value for key, value in request.headers if key.lower() != 'host'}
    data = request.get_data()
    resp = requests.request(method, url, headers=req_headers, data=data, params=request.args, allow_redirects=False)

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'access-control-allow-origin']
    headers = [(name, value) for (name, value) in resp.raw.headers.items() if name.lower() not in excluded_headers]

    proxy_domain = request.host.split(':')[0]
    new_headers = []
    for name, value in headers:
        if name.lower() == 'set-cookie':
            value = re.sub(r'Domain=[^;]+', f'Domain={proxy_domain}', value, flags=re.IGNORECASE)
        new_headers.append((name, value))

    return resp, new_headers


@app.route('/location', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def location():
    url = ''.join(request.url.split("/location?url=")[1:])
    resp, headers = get_response(request, unquote(url))

    return Response(resp.headers.get("Location") if 300 <= resp.status_code < 400 else resp.content, 200 if 300 <= resp.status_code < 400 else resp.status_code, headers)


@app.route('/proxy', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy():
    url = ''.join(request.url.split("/proxy?url=")[1:])
    resp, headers = get_response(request, unquote(url))

    return Response(resp.content, resp.status_code, headers)


@app.route('/logout')
def logout():
    response = make_response("Logged out and all cookies removed.")

    for cookie in request.cookies:
        response.delete_cookie(cookie)

    parsed_url = parse_qs(urlparse(request.url).query)

    if len([print(name + ":", value[0]) for (name, value) in parsed_url.items()]):
        print()

    return response


@app.route('/<path:subpath>', methods=['GET'])
def server(subpath):
    base_dir = os.path.abspath("")
    for ext in ['', '.html']:
        filepath = os.path.join(base_dir, subpath + ext)
        if os.path.exists(filepath) and os.path.isfile(filepath):
            return send_from_directory(base_dir, subpath + ext)
    return "File not found", 404


if __name__ == '__main__':
    app.run(host="127.0.0.1", port=65000)

