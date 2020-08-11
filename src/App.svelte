<script lang="typescript">
  import { onMount } from "svelte";

  let input: HTMLInputElement;

  // 入力欄値更新時
  const handleClick = (e: Event): void => {
    const word = input.value;
    if ("chrome" in window && "webview" in window["chrome"]) {
      // WebView2 から呼び出されてるならメッセージ
      window["chrome"].webview.postMessage(`google:${word}`);
    } else {
      // ブラウザからなら通常の新しいウインドウ
      window.open(`https://www.google.com/search?q=${word}`);
    }
    input.value = "";
  };

  // 初期化時
  onMount(() => {
    input.focus();
  });

  // WebView2 活性時
  window["OnActive"] = () => {
    input.focus();
  };
</script>

<style lang="scss">
  input {
    width: 100%;
  }
</style>

<main>
  <input bind:this={input} type="text" on:change={handleClick} />
</main>
