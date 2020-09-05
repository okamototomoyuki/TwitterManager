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

  let consumerKey: string;
  let consumerSecret: string;
  let accessTokenKey: string;
  let accessTokenSecret: string;
  let threadId: string;

  let client: Twitter;
  let tweets: any[] = [];
  let filters: any[] = [];
  let lastId: string;

  // 初期化時
  onMount(async () => {
    const url = new URL(location.href);
    const params = url.searchParams;
    consumerKey = params.get("consumer_key") ?? "";
    consumerSecret = params.get("consumer_secret") ?? "";
    accessTokenKey = params.get("access_token_key") ?? "";
    accessTokenSecret = params.get("access_token_secret") ?? "";
    threadId = params.get("thread_id") ?? "";

    if (
      consumerKey.length == 0 ||
      consumerSecret.length == 0 ||
      accessTokenKey.length == 0 ||
      accessTokenSecret.length == 0
    ) {
      state = _STATE.ERROR;
      error =
        "consumer_key、consumer_secret、access_token_key または access_token_secretを URL で指定してください。";
      alert(error);
      return;
    }

    // 記録情報で認証
    client = new Twitter({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      access_token_key: accessTokenKey,
      access_token_secret: accessTokenSecret,
    });

    // Tweet 初期収集
    let maxId = "";
    while (true) {
      const param = { count: 200 };
      if (maxId !== "") {
        param["max_id"] = maxId;
      }

      const adds = await client.get("statuses/user_timeline", param);

      tweets = tweets.concat(adds);
      if (adds.length < 200) {
        break;
      } else {
        maxId = tweets[tweets.length - 1].id_str;
      }
    }

    // 追加収集関数作成
    let prevId = 0;
    let addTweet = async () => {
      const param = { count: 1 };
      const adds = await client.get("statuses/user_timeline", param);
      if (adds.length == 1) {
        const id = parseInt(adds[0].id_str);
        console.info(`${id}  ${prevId}`);
        if (id > prevId) {
          console.info(0);
          prevId = id;
          tweets = adds.concat(tweets);
        }
      }

      console.info(1);
      // スレッドが指定されたらそのスレッドの情報だけ取得
      if (threadId.length > 0) {
        filters = [];
        const t = tweets.find((e) => e.id_str == threadId);
        if (t != null) {
          filters.push(t);

          // 子を検索
          let cs = tweets.filter(
            (e) => t.id_str == e.in_reply_to_status_id_str
          );
          while (cs.length > 0) {
            const c = cs.sort(
              (a, b) => parseInt(a.id_str) - parseInt(b.id_str)
            )[0];
            filters.unshift(c);
            cs = tweets.filter((e) => c.id_str == e.in_reply_to_status_id_str);
          }

          // 親を検索
          let p = tweets.find((e) => t.in_reply_to_status_id_str == e.id_str);
          while (p != null) {
            filters.push(p);
            p = tweets.find((e) => p.in_reply_to_status_id_str == e.id_str);
          }

          // コメントするときの親を取得
          if (filters.length > 0) {
            lastId = filters[0].id_str;
          }
        }
      } else {
        console.info(2);
        filters = tweets;
      }
    };

    document.addEventListener("keydown", async function (e) {
      if (e.code == "Enter" && e.ctrlKey) {
        e.preventDefault();

        const v = text.value;
        text.value = "";

        const param = {
          status: v,
          auto_populate_reply_metadata: true,
        };

        if (threadId !== "") {
          param["in_reply_to_status_id"] = lastId;
        }

        await client.post("statuses/update", param);

        addTweet();
      }
    });

    text.focus();

    addTweet();
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
  .tweet {
    border: {
      style: solid;
      bottom-width: 1px;
      top-width: 0px;
      left-width: 0px;
      right-width: 0px;
    }
  }
</style>

<main>
  <textarea bind:this={text} />
  {#each filters as tweet}
    <div class="tweet">
      <div>
        {#each tweet.text.split(/(\n)/) as line}
          <div>{line}</div>
        {/each}
      </div>
      <div>
        <a
          href="?consumer_key={consumerKey}&consumer_secret={consumerSecret}&access_token_key={accessTokenKey}&access_token_secret={accessTokenSecret}&thread_id={tweet.id_str}">
          &#x25b6;
        </a>
      </div>
    </div>
  {/each}
</main>
