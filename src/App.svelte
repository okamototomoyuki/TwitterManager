<script lang="typescript">
  import { onMount } from "svelte";
  import { xlink_attr } from "svelte/internal";

  enum _STATE {
    NONE,
    INIT,
    REQUIRE,
    DONE,
    ERROR,
  }

  class KV {
    key: string;
    value: string;
    constructor(key: string, value: string) {
      this.key = key;
      this.value = value;
    }
  }

  class Twitter {
    _apiKey: string;
    _apiSecretKey: string;
    _accessToken: string;
    _accessTokenSecret: string;

    constructor(
      apiKey: string,
      apiSecretKey: string,
      accessToken: string,
      accessTokenSecret: string
    ) {
      this._apiKey = apiKey;
      this._apiSecretKey = apiSecretKey;
      this._accessToken = accessToken;
      this._accessTokenSecret = accessTokenSecret;
    }

    async get(url: string, params: KV[]) {
      const query = this._percentEncodeParams(params)
        .map((pair) => pair.key + "=" + pair.value)
        .join("&");

      const method = "GET";

      // 認証情報
      const authorizationHeader = await this._getAuthorizationHeader(
        method,
        url,
        params
      );

      const headers = { Authorization: authorizationHeader };

      // 通信
      const response = await fetch(!params ? url : url + "?" + query, {
        method,
        headers,
      });

      return response.json();
    }

    async _getAuthorizationHeader(method: string, url: string, params: KV[]) {
      // パラメータ準備
      const oauthParams = [
        new KV("oauth_consumer_key", this._apiKey),
        new KV("oauth_nonce", this._getNonce()),
        new KV("oauth_signature_method", "HMAC-SHA1"),
        new KV("oauth_timestamp", this._getTimestamp().toString()),
        new KV("oauth_token", this._accessToken),
        new KV("oauth_version", "1.0"),
      ];

      const allParams = this._percentEncodeParams([...oauthParams, ...params]);

      this._ksort(allParams);

      // シグネチャ作成
      const signature = await this._getSignature(method, url, allParams);

      // 認証情報
      return (
        "OAuth " +
        this._percentEncodeParams([
          ...oauthParams,
          new KV("oauth_signature", signature),
        ])
          .map((pair) => pair.key + '="' + pair.value + '"')
          .join(", ")
      );
    }

    async _getSignature(method: string, url: string, allParams: KV[]) {
      const allQuery = allParams
        .map((pair) => pair.key + "=" + pair.value)
        .join("&");

      // シグネチャベース・キー文字列
      const signatureBaseString = [
        method.toUpperCase(),
        this._percentEncode(url),
        this._percentEncode(allQuery),
      ].join("&");

      const signatureKeyString = [this._apiSecretKey, this._accessTokenSecret]
        .map((secret) => this._percentEncode(secret))
        .join("&");

      // シグネチャベース・キー
      const signatureBase = this._stringToUint8Array(signatureBaseString);
      const signatureKey = this._stringToUint8Array(signatureKeyString);

      // シグネチャ計算
      const signatureCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        signatureKey,
        { name: "HMAC", hash: { name: "SHA-1" } },
        true,
        ["sign"]
      );

      const signatureArrayBuffer = await window.crypto.subtle.sign(
        "HMAC",
        signatureCryptoKey,
        signatureBase
      );

      return this._arrayBufferToBase64String(signatureArrayBuffer);
    }

    /**
     * RFC3986 仕様の encodeURIComponent
     */
    _percentEncode(str: string) {
      return encodeURIComponent(str).replace(
        /[!'()*]/g,
        (char) => "%" + char.charCodeAt(0).toString(16)
      );
    }

    _percentEncodeParams(params: KV[]) {
      return params.map((pair) => {
        const key = this._percentEncode(pair.key);
        const value = this._percentEncode(pair.value);
        return { key, value };
      });
    }

    _ksort(params: KV[]) {
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
      return [...array]
        .map((uint) => uint.toString(16).padStart(2, "0"))
        .join("");
    }

    _getTimestamp() {
      return Math.floor(Date.now() / 1000);
    }

    _stringToUint8Array(str: string) {
      return Uint8Array.from(Array.from(str).map((char) => char.charCodeAt(0)));
    }

    _arrayBufferToBase64String(arrayBuffer: ArrayBuffer) {
      const string = new Uint8Array(arrayBuffer)
        .reduce((data, char) => {
          data.push(String.fromCharCode(char));
          return data;
        }, [] as string[])
        .join("");

      return btoa(string);
    }
  }

  let state: _STATE;
  let error: String;
  let text: HTMLTextAreaElement;

  // 入力欄値更新時
  const handleClick = (e: Event): void => {
    const word = text.value;
    if ("chrome" in window && "webview" in window["chrome"]) {
      // WebView2 から呼び出されてるならメッセージ
      window["chrome"].webview.postMessage(`google:${word}`);
    } else {
      // ブラウザからなら通常の新しいウインドウ
      window.open(`https://www.google.com/search?q=${word}`);
    }
    text.value = "";
  };

  // 初期化時
  onMount(async () => {
    state = _STATE.INIT;
    const url = new URL(location.href);
    const params = url.searchParams;
    const consumerKey = params.get("consumer_key") ?? "";
    const consumerSecret = params.get("consumer_secret") ?? "";
    const access_token_key = params.get("access_token_key") ?? "";
    const access_token_secret = params.get("access_token_secret") ?? "";

    if (consumerKey.length == 0 || consumerSecret.length == 0) {
      state = _STATE.ERROR;
      error =
        "consumer_key、consumer_secret、access_token_key または access_token_secretを URL で指定してください。";
      return;
    }

    // 記録情報で認証
    const client = new Twitter(
      consumerKey,
      consumerSecret,
      access_token_key,
      access_token_secret
    );
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
</script>

<style lang="scss">
  textarea {
    width: 100%;
    height: 100%;
  }
</style>

<main>
  {#if state == _STATE.ERROR}
    <div>{error}</div>
  {:else if state == _STATE.INIT}
    初期化中
  {:else if state == _STATE.REQUIRE}
    <button on:change={handleClick}>認証</button>
  {:else}
    <textarea bind:this={text} on:change={handleClick} />
  {/if}
</main>
