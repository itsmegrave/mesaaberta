#!/usr/bin/env python3
"""Bounded, read-only SEO probe. Python 3.10+, no packages or credentials required.

Usage: python3 collect.py > evidence-new.json
Requests public documents only; it does not log in, submit forms or crawl APIs.
"""
import concurrent.futures
import datetime
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

ORIGIN = "https://mesaaberta.app"
PATHS = [
    "/", "/t", "/p", "/cf", "/changelog", "/robots.txt", "/sitemap.xml",
    "/sitemap-index.xml", "/login", "/signup", "/forgot", "/privacy", "/terms",
    "/t?page=1", "/t?page=2", "/t?page=999", "/t?utm_source=seo-spike",
    "/t?modality=online", "/t?modality=in_person",
    "/t?modality=online&modality=online", "/t?system=seo-spike-no-such-system",
    "/t?tag=seo-spike-no-such-tag", "/cf?status=ended",
    "/cf?status=ended&page=999", "/cf?q=seo-spike-no-such-campaign",
    "/p?q=seo-spike-no-such-partner", "/login?next=%2Fm", "/m", "/u/tables",
    "/t/new", "/t/seo-spike-no-such-table", "/not-a-real-page-seo-spike",
    "/tables", "/t/", "/pt-BR/t", "/en/t",
]
HEADERS = ["content-type", "location", "x-robots-tag", "cache-control", "link"]


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.descriptions = []
        self.robots = []
        self.canonicals = []
        self.open_graph = []
        self.links = []
        self.h1 = []
        self.words = []
        self.json_ld_count = 0
        self.in_title = False
        self.in_h1 = False
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.in_h1 = True
            self.h1.append("")
        if tag == "meta":
            name = data.get("name", "").lower()
            if name == "description":
                self.descriptions.append(data.get("content", ""))
            if name == "robots":
                self.robots.append(data.get("content", ""))
            if data.get("property", "").startswith("og:"):
                self.open_graph.append(data["property"])
        if tag == "link" and "canonical" in data.get("rel", "").split():
            self.canonicals.append(data.get("href", ""))
        if tag == "a" and data.get("href"):
            self.links.append(data["href"])
        if tag == "script" and data.get("type") == "application/ld+json":
            self.json_ld_count += 1
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "h1":
            self.in_h1 = False
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, text):
        if self.in_title:
            self.title += text
        if self.in_h1:
            self.h1[-1] += text
        if not self.skip:
            self.words.extend(text.split())


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch(path):
    requested = urllib.parse.urljoin(ORIGIN, path)
    url = requested
    chain = []
    opener = urllib.request.build_opener(NoRedirect())
    try:
        for _ in range(6):
            req = urllib.request.Request(url, headers={
                "User-Agent": "MesaAberta-SEO-Spike/1.0 (read-only public audit)"
            })
            try:
                response = opener.open(req, timeout=25)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                status = response.code
                headers = {key: response.headers[key] for key in HEADERS if key in response.headers}
                body = response.read(2_000_001)
            chain.append({"url": url, "status": status, "headers": headers})
            if status not in (301, 302, 303, 307, 308) or "location" not in headers:
                break
            target = urllib.parse.urljoin(url, headers["location"])
            if urllib.parse.urlsplit(target).netloc != urllib.parse.urlsplit(ORIGIN).netloc:
                return {"requested": requested, "chain": chain, "externalRedirect": target}
            url = target
        else:
            return {"requested": requested, "chain": chain, "error": "redirect limit"}
        if len(body) > 2_000_000:
            return {"requested": requested, "chain": chain, "error": "document exceeds probe limit"}
        document = Document()
        if "text/html" in headers.get("content-type", ""):
            document.feed(body.decode("utf-8", "replace"))
        return {
            "requested": requested, "finalUrl": url, "status": status, "chain": chain,
            "title": document.title, "description": document.descriptions,
            "robots": document.robots, "canonical": document.canonicals,
            "openGraphProperties": sorted(set(document.open_graph)),
            "h1": document.h1, "jsonLdCount": document.json_ld_count,
            "wordCount": len(document.words),
            "visibleTextSha256": hashlib.sha256(" ".join(document.words).encode()).hexdigest(),
            "links": list(dict.fromkeys(document.links)),
            "robotsTxt": body.decode("utf-8", "replace") if path == "/robots.txt" else None,
        }
    except (OSError, urllib.error.URLError) as error:
        return {"requested": requested, "chain": chain, "error": str(error)}


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(fetch, PATHS))
    details = []
    for response in responses:
        if response["requested"] not in (ORIGIN + "/", ORIGIN + "/t"):
            continue
        for href in response.get("links", []):
            target = urllib.parse.urljoin(ORIGIN, href)
            parts = urllib.parse.urlsplit(target)
            if parts.netloc != urllib.parse.urlsplit(ORIGIN).netloc:
                continue
            if parts.path.startswith(("/t/", "/u/")) and parts.path not in (
                "/t/new", "/u/tables", "/u/profile/edit"
            ) and target not in details:
                details.append(target)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        responses.extend(pool.map(fetch, details[:6]))
    print(json.dumps({
        "capturedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "origin": ORIGIN,
        "scope": "Public HTML and robots; no authenticated analytics or verified crawler access",
        "responses": responses,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
