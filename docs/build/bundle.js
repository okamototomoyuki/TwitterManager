
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function xlink_attr(node, attribute, value) {
        node.setAttributeNS('http://www.w3.org/1999/xlink', attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.24.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.24.1 */

    const { console: console_1 } = globals;
    const file = "src\\App.svelte";

    // (206:2) {:else}
    function create_else_block(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "class", "svelte-uwri2g");
    			add_location(textarea, file, 206, 4, 7272);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			/*textarea_binding*/ ctx[5](textarea);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "change", /*handleClick*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			/*textarea_binding*/ ctx[5](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(206:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (204:36) 
    function create_if_block_2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "認証";
    			add_location(button, file, 204, 4, 7214);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "change", /*handleClick*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(204:36) ",
    		ctx
    	});

    	return block;
    }

    // (202:33) 
    function create_if_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("初期化中");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(202:33) ",
    		ctx
    	});

    	return block;
    }

    // (200:2) {#if state == _STATE.ERROR}
    function create_if_block(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*error*/ ctx[2]);
    			add_location(div, file, 200, 4, 7111);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 4) set_data_dev(t, /*error*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(200:2) {#if state == _STATE.ERROR}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*state*/ ctx[1] == /*_STATE*/ ctx[0].ERROR) return create_if_block;
    		if (/*state*/ ctx[1] == /*_STATE*/ ctx[0].INIT) return create_if_block_1;
    		if (/*state*/ ctx[1] == /*_STATE*/ ctx[0].REQUIRE) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			add_location(main, file, 198, 0, 7070);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	var _STATE;

    	(function (_STATE) {
    		_STATE[_STATE["NONE"] = 0] = "NONE";
    		_STATE[_STATE["INIT"] = 1] = "INIT";
    		_STATE[_STATE["REQUIRE"] = 2] = "REQUIRE";
    		_STATE[_STATE["DONE"] = 3] = "DONE";
    		_STATE[_STATE["ERROR"] = 4] = "ERROR";
    	})(_STATE || (_STATE = {}));

    	class KV {
    		constructor(key, value) {
    			this.key = key;
    			this.value = value;
    		}
    	}

    	class Twitter {
    		constructor(apiKey, apiSecretKey, accessToken, accessTokenSecret) {
    			this._apiKey = apiKey;
    			this._apiSecretKey = apiSecretKey;
    			this._accessToken = accessToken;
    			this._accessTokenSecret = accessTokenSecret;
    		}

    		async get(url, params) {
    			const query = this._percentEncodeParams(params).map(pair => pair.key + "=" + pair.value).join("&");
    			const method = "GET";

    			// 認証情報
    			const authorizationHeader = await this._getAuthorizationHeader(method, url, params);

    			const headers = { Authorization: authorizationHeader };

    			// 通信
    			const response = await fetch(!params ? url : url + "?" + query, { method, headers });

    			return response.json();
    		}

    		async _getAuthorizationHeader(method, url, params) {
    			// パラメータ準備
    			const oauthParams = [
    				new KV("oauth_consumer_key", this._apiKey),
    				new KV("oauth_nonce", this._getNonce()),
    				new KV("oauth_signature_method", "HMAC-SHA1"),
    				new KV("oauth_timestamp", this._getTimestamp().toString()),
    				new KV("oauth_token", this._accessToken),
    				new KV("oauth_version", "1.0")
    			];

    			const allParams = this._percentEncodeParams([...oauthParams, ...params]);
    			this._ksort(allParams);

    			// シグネチャ作成
    			const signature = await this._getSignature(method, url, allParams);

    			// 認証情報
    			return "OAuth " + this._percentEncodeParams([...oauthParams, new KV("oauth_signature", signature)]).map(pair => pair.key + "=\"" + pair.value + "\"").join(", ");
    		}

    		async _getSignature(method, url, allParams) {
    			const allQuery = allParams.map(pair => pair.key + "=" + pair.value).join("&");

    			// シグネチャベース・キー文字列
    			const signatureBaseString = [
    				method.toUpperCase(),
    				this._percentEncode(url),
    				this._percentEncode(allQuery)
    			].join("&");

    			const signatureKeyString = [this._apiSecretKey, this._accessTokenSecret].map(secret => this._percentEncode(secret)).join("&");

    			// シグネチャベース・キー
    			const signatureBase = this._stringToUint8Array(signatureBaseString);

    			const signatureKey = this._stringToUint8Array(signatureKeyString);

    			// シグネチャ計算
    			const signatureCryptoKey = await window.crypto.subtle.importKey("raw", signatureKey, { name: "HMAC", hash: { name: "SHA-1" } }, true, ["sign"]);

    			const signatureArrayBuffer = await window.crypto.subtle.sign("HMAC", signatureCryptoKey, signatureBase);
    			return this._arrayBufferToBase64String(signatureArrayBuffer);
    		}

    		/**
     * RFC3986 仕様の encodeURIComponent
     */
    		_percentEncode(str) {
    			return encodeURIComponent(str).replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16));
    		}

    		_percentEncodeParams(params) {
    			return params.map(pair => {
    				const key = this._percentEncode(pair.key);
    				const value = this._percentEncode(pair.value);
    				return { key, value };
    			});
    		}

    		_ksort(params) {
    			return params.sort((a, b) => {
    				const keyA = a.key;
    				const keyB = b.key;
    				if (keyA < keyB) return -1;
    				if (keyA > keyB) return 1;
    				return 0;
    			});
    		}

    		_getNonce() {
    			const array = new Uint8Array(32);
    			window.crypto.getRandomValues(array);

    			// メモ: Uint8Array のままだと String に変換できないので、Array に変換してから map
    			return [...array].map(uint => uint.toString(16).padStart(2, "0")).join("");
    		}

    		_getTimestamp() {
    			return Math.floor(Date.now() / 1000);
    		}

    		_stringToUint8Array(str) {
    			return Uint8Array.from(Array.from(str).map(char => char.charCodeAt(0)));
    		}

    		_arrayBufferToBase64String(arrayBuffer) {
    			const string = new Uint8Array(arrayBuffer).reduce(
    				(data, char) => {
    					data.push(String.fromCharCode(char));
    					return data;
    				},
    				[]
    			).join("");

    			return btoa(string);
    		}
    	}

    	let state;
    	let error;
    	let text;

    	// 入力欄値更新時
    	const handleClick = e => {
    		const word = text.value;

    		if ("chrome" in window && "webview" in window["chrome"]) {
    			// WebView2 から呼び出されてるならメッセージ
    			window["chrome"].webview.postMessage(`google:${word}`);
    		} else {
    			// ブラウザからなら通常の新しいウインドウ
    			window.open(`https://www.google.com/search?q=${word}`);
    		}

    		$$invalidate(3, text.value = "", text);
    	};

    	// 初期化時
    	onMount(async () => {
    		$$invalidate(1, state = _STATE.INIT);
    		const url = new URL(location.href);
    		const params = url.searchParams;
    		const consumerKey = params.get("consumer_key") ?? "";
    		const consumerSecret = params.get("consumer_secret") ?? "";
    		const access_token_key = params.get("access_token_key") ?? "";
    		const access_token_secret = params.get("access_token_secret") ?? "";

    		if (consumerKey.length == 0 || consumerSecret.length == 0) {
    			$$invalidate(1, state = _STATE.ERROR);
    			$$invalidate(2, error = "consumer_key、consumer_secret、access_token_key または access_token_secretを URL で指定してください。");
    			return;
    		}

    		// 記録情報で認証
    		const client = new Twitter(consumerKey, consumerSecret, access_token_key, access_token_secret);

    		const u = "https://api.twitter.com/1.1/friends/list.json";
    		const p = [new KV("screen_name", "TwitterJP")];
    		const json = await client.get(u, p);
    		console.info(json);

    		// var cred = await client.get("account/verify_credentials2");
    		// 記録情報がNGなら認証
    		// if (result.access_token == null) {
    		//   state = _STATE.REQUIRE;
    		//   client = new Twitter({
    		//     consumer_key: consumerKey,
    		//     consumer_secret: consumerSecret,
    		//   });
    		//   let tokenReponse = await client.getRequestToken("https://google.com");
    		//   if (result.access_token == null) {
    		//     state = _STATE.ERROR;
    		//     error = "認証に失敗しました。";
    		//     return;
    		//   }
    		// }
    		// if (userToken == null || userSecret == null) {
    		//   //
    		// }
    		text.focus();
    	});

    	// WebView2 活性時
    	window["OnActive"] = () => {
    		text.focus();
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function textarea_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			text = $$value;
    			$$invalidate(3, text);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		xlink_attr,
    		_STATE,
    		KV,
    		Twitter,
    		state,
    		error,
    		text,
    		handleClick
    	});

    	$$self.$inject_state = $$props => {
    		if ("_STATE" in $$props) $$invalidate(0, _STATE = $$props._STATE);
    		if ("state" in $$props) $$invalidate(1, state = $$props.state);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    		if ("text" in $$props) $$invalidate(3, text = $$props.text);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [_STATE, state, error, text, handleClick, textarea_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world',
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
