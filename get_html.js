(async () => {
	fixURL = function(url) {
		return new URL(url, origin).href.replace(document.location.href.split("/").slice(0, -1).join("/"), origin);
	};
	
	interceptFetch = function() {
		serverAddress = 'http://127.0.0.1:65000'
		proxyPrefix = serverAddress + '/proxy?url=';
		originalFetch = fetch;
		fetch = async function(input, init) {
			let url = (typeof input === 'string') ? input : input.url;
			if (url.startsWith('http') && !url.startsWith(serverAddress)) {
				url = proxyPrefix + encodeURIComponent(url);
				if (typeof input === 'string') {
					input = url;
				} else {
					input = new Request(url, input);
				}
			}
		
			return originalFetch(input, init);
		};
	};
	interceptFetch();
	
	currentURL = document.location.href.replace(document.location.origin, origin);
	
	try {
		if(window["get_html"] === false) throw new Error();
		
		const res = await fetch(currentURL);
		const html = await res.text();
		const doc = new DOMParser().parseFromString(html, 'text/html');
		
		function rewriteUrls(root) {
			const attrs = ['src', 'href', 'srcset', 'data-src'];
			root.querySelectorAll('*').forEach(el => {
				attrs.forEach(attr => {
					if (!el.hasAttribute(attr)) return;
		
					let val = el.getAttribute(attr);
					if (!val) return;
		
					if (attr === 'srcset') {
						const parts = val.split(',').map(part => {
							let [url, desc] = part.trim().split(/\s+/);
							const absUrl = fixURL(url);
							if (absUrl.startsWith('http') && url != "https://www.atera.com/favicon.png") url = proxyPrefix + encodeURIComponent(absUrl);
							return desc ? `${url} ${desc}` : url;
						});
						el.setAttribute(attr, parts.join(', '));
						return;
					}
		
					const absUrl = fixURL(val);
					if (absUrl.startsWith('http') && absUrl != "https://www.atera.com/favicon.png") {
						el.setAttribute(attr, proxyPrefix + encodeURIComponent(absUrl));
					}
				});
			});
		}
		
		rewriteUrls(document);
		
		document.head.innerHTML = doc.head.innerHTML;
		document.body.innerHTML = doc.body.innerHTML;
		
		const scriptPromises = [...doc.scripts].map(oldScript => {
			return new Promise(resolve => {
				const newScript = document.createElement('script');
				if (oldScript.src) {
					const absSrc = fixURL(oldScript.src);
					newScript.src = proxyPrefix + encodeURIComponent(absSrc);
					newScript.onload = resolve;
					newScript.onerror = resolve;
				} else {
					newScript.textContent = "";
					
					resolve();
				}
		
				document.head.appendChild(newScript);
			});
		});
		await Promise.all(scriptPromises);
	}catch(e){
	} finally {
		await html_callback();
	}
})();