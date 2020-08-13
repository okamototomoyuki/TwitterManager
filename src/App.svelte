<script lang="typescript">
  import { onMount } from "svelte";
  import { xlink_attr } from "svelte/internal";
  import Twitter from "twitter-lite";

  enum _STATE {
    NONE,
    INIT,
    REQUIRE,
    DONE,
    ERROR,
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

    if (consumerKey.length == 0 || consumerSecret.length == 0) {
      state = _STATE.ERROR;
      error = "consumer_key または consumer_secret を URL で指定してください。";
      return;
    }

    // 記録情報で認証
    const userToken = window.localStorage.getItem("USER_TOKEN") ?? "";
    const userSecret = window.localStorage.getItem("USER_SECRET") ?? "";
    let client = new Twitter({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      access_token_key: userToken,
      access_token_secret: userSecret,
    });
    let result = await client.getBearerToken();

    // 記録情報がNGなら認証
    if (result.access_token == null) {
      state = _STATE.REQUIRE;
      client = new Twitter({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      });
      let tokenReponse = await client.getRequestToken("https://google.com");

      if (result.access_token == null) {
        state = _STATE.ERROR;
        error = "認証に失敗しました。";
        return;
      }
    }

    if (userToken == null || userSecret == null) {
      //
    }

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
