const slack = require("@slack/web-api");
const fs = require("fs");

const parseEnv = () => {
  const env = {};
  const names = ["SLACK_BOT_TOKEN", "NEWCHAN_STATE_FILE", "SLACK_CHANNEL_NAME"];
  for (const n of names) {
    if (!process.env[n]) {
      throw new Error(`環境変数 ${n} を指定してください`);
    }
    env[n] = process.env[n];
  }
  return env;
};

/**
 * @param {slack.WebClient} web
 */
const allChannels = async (web) => {
  let cursor = "";
  let channels = [];
  while (true) {
    const r = await web.conversations.list({
      limit: 1000,
      exclude_archived: true,
      cursor,
    });
    if (!r.ok) {
      throw new Error("unreachable"); // @slack/web-api は error 時に throw するはず…
    }
    channels.push(...r.channels);
    if (r.response_metadata && r.response_metadata.next_cursor) {
      cursor = r.response_metadata.next_cursor;
      continue;
    }
    break;
  }
  return channels;
};

/**
 * @param {slack.ChannelsListResponse["channels"]} channels
 * @param {slack.UsersListResponse["members"]} members
 */
const createBody = (channels, members) => ({
  text: "New channel just landed! :tada:",
  attachments: channels.map((ch) => {
    const a = {
      type: "plain_text",
      text: `<#${ch.id}>`,
      color: "#ff91ba",
      ts: ch.created,
    };
    if (ch.topic.value) {
      a.footer = ch.topic.value;
    }
    const creator = members.find((m) => m.id === ch.creator);
    if (!creator) return a;
    return {
      ...a,
      author_name: creator.profile.display_name || creator.profile.real_name,
      author_icon: creator.profile.image_72, // image_* が常にあるのかよくわからない
      author_link: `slack://user?id=${creator.id}&team=${creator.team_id}`,
    };
  }),
});

/**
 * @param {string} m
 */
const debug = (m) => console.error(m);

const main = async () => {
  const env = parseEnv();
  // Numberを使う: http://nmi.jp/2022-02-03-dont-use-parseInt
  const sinceTime = Number(
    fs.readFileSync(env.NEWCHAN_STATE_FILE, { encoding: "utf-8" }).trim()
  );
  if (Number.isNaN(sinceTime)) {
    throw new Error("UNIX epochは数値で指定してください");
  }
  debug(sinceTime);

  const web = new slack.WebClient(env.SLACK_BOT_TOKEN);
  await web.auth.test();

  debug("fetching users");
  const users = await web.users.list();
  debug("fetching channels");
  const channels = await allChannels(web);

  // 昇順 (古い順) に並べる
  const newChannels = channels
    .filter((c) => c.created > sinceTime)
    .sort((a, b) => a.created - b.created);
  if (newChannels.length === 0) {
    debug(`no new channels found`);
    return;
  }
  debug(`new ${newChannels.length} channels found`);

  const targetChannel = channels.find(
    (ch) => ch.name === env.SLACK_CHANNEL_NAME
  );
  if (!targetChannel) {
    throw new Error("投稿先のチャンネルが見つかりません");
  }
  if (!targetChannel.is_member) {
    await web.conversations.join({ channel: targetChannel.id });
  }
  const message = {
    channel: targetChannel.id,
    ...createBody(newChannels, users.members),
  };
  debug(message);
  await web.chat.postMessage(message);

  const lastTime = newChannels.reduce(
    (prev, ch) => (prev < ch.created ? ch.created : prev),
    0
  );
  fs.writeFileSync(env.NEWCHAN_STATE_FILE, lastTime.toString(), {
    encoding: "utf-8",
  });
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    if (e.code === ErrorCode.PlatformError) {
      debug(e.data);
    }
    debug(e);
    process.exit(1);
  });
