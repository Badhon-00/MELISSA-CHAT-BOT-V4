^cmd install autodl.js const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { pipeline } = require("stream/promises");

const downloadCache = new Map();

const baseApiUrl = async () => {
  const base = await axios.get(
    `https://raw.githubusercontent.com/cyber-ullash/cyber-ullash/refs/heads/main/UllashApi.json`,
  );
  return base.data.api;
};

const supportedDomains = [
  { domain: 'facebook.com' },
  { domain: 'instagram.com' },
  { domain: 'youtube.com' },
  { domain: 'youtu.be' },
  { domain: 'pinterest.com' },
  { domain: 'tiktok.com' },
  { domain: 'x.com' },
  { domain: 'twitter.com' },
  { domain: 'fb.watch' },
  { domain: 'vt.tiktok.com' },
  { domain: 'vm.tiktok.com' }
];

function getMainDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === 'youtu.be') return 'youtube.com';
    if (hostname === 'fb.watch') return 'facebook.com';
    if (hostname === 'vt.tiktok.com') return 'tiktok.com';
    if (hostname === 'vm.tiktok.com') return 'tiktok.com';
    const parts = hostname.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
  } catch (e) {
    return null;
  }
}

async function shortenURL(url) {
  try {
    const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    return response.data;
  } catch (error) {
    return url;
  }
}

async function tryAllApis(url) {
  const apis = [
    {
      name: "Blankid018 API",
      handler: async () => {
        const { data } = await axios.get(
          "https://raw.githubusercontent.com/Blankid018/D1PT0/main/baseApiUrl.json"
        );
        if (Array.isArray(data.apis)) {
          for (const baseApi of data.apis) {
            try {
              const res = await axios.get(
                `${baseApi}/nazrul/alldlxx?url=${encodeURIComponent(url)}`,
                { timeout: 10000 }
              );
              if (res.data && res.data.url) {
                return { url: res.data.url, title: res.data.t || "", caption: res.data.p || "" };
              }
            } catch (e) {}
          }
        }
        return null;
      }
    },
    {
      name: "Nazrul API",
      handler: async () => {
        const { data } = await axios.get(
          "https://raw.githubusercontent.com/nazrul4x/Noobs/main/Apis.json"
        );
        if (data.api) {
          const res = await axios.get(
            `${data.api}/nazrul/alldlxx?url=${encodeURIComponent(url)}`,
            { timeout: 10000 }
          );
          if (res.data && res.data.url) {
            return { url: res.data.url, title: res.data.t || "", caption: res.data.p || "" };
          }
        }
        return null;
      }
    },
    {
      name: "Ullash API",
      handler: async () => {
        const ullashApi = await baseApiUrl();
        const { data } = await axios.get(
          `${ullashApi}/alldl?url=${encodeURIComponent(url)}`,
          { timeout: 10000 }
        );
        if (data && data.result) {
          return { url: data.result, title: data.cp || "", caption: "" };
        }
        return null;
      }
    },
    {
      name: "FreeGoat API",
      handler: async () => {
        const res = await axios.get(`https://free-goat-api.onrender.com/alldl?url=${encodeURIComponent(url)}`, {
          timeout: 15000
        });
        if (res.data?.status) {
          const streamUrl = res.data?.links?.hd || res.data?.links?.sd || res.data?.links?.mp3;
          if (streamUrl) {
            return { url: streamUrl, title: res.data.title || "", caption: "" };
          }
        }
        return null;
      }
    }
  ];

  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      const result = await api.handler();
      if (result && result.url) {
        console.log(`Success with ${api.name}`);
        return result;
      }
    } catch (error) {
      console.log(`${api.name} failed:`, error.message);
      continue;
    }
  }
  return null;
}

async function downloadAndSend({ url, result, sendMessage, threadID, messageID, setReaction }) {
  try {
    const fileExt = path.extname(result.url) || '.mp4';
    const filePath = path.join(os.tmpdir(), `autodl_${Date.now()}${fileExt}`);

    const streamRes = await axios({
      url: result.url,
      method: "GET",
      responseType: "stream",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        Referer: result.url
      },
      maxRedirects: 5,
      validateStatus: s => s >= 200 && s < 400
    });

    await pipeline(streamRes.data, fs.createWriteStream(filePath));

    downloadCache.set(url, filePath);

    const shortUrl = await shortenURL(result.url);
    let caption = "";
    if (result.title) caption += `${result.title}\n`;
    if (result.caption) caption += `${result.caption}\n`;
    caption += `✅ | Link: ${shortUrl}`;
    caption = caption.trim();

    await sendMessage({
      body: caption,
      attachment: fs.createReadStream(filePath)
    }, threadID);

    if (setReaction) setReaction("✅", messageID, () => {}, true);

    setTimeout(() => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }, 60000);

    return true;
  } catch (error) {
    console.error("Download error:", error);
    throw error;
  }
}

module.exports = {
  config: {
    name: "autodl",
    aliases: ["autodl", "dl", "fbdl", "ytdl", "instadl", "alldl"],
    version: "3.0.0",
    author: "BADHON",
    role: 0,
    description: "Auto-download media with API fallback + cache",
    category: "media",
    guide: { en: "Send any media link - automatically downloads using best available API" }
  },

  onStart: async function ({ message, args, event, threadsData, role, api }) {
    if (['on', 'off'].includes(args[0])) {
      if (role < 1) return message.reply('Access denied.');
      const choice = args[0] === 'on';
      const gcData = (await threadsData.get(event.threadID, "data")) || {};
      await threadsData.set(event.threadID, { data: { ...gcData, autoDownload: choice } });
      return message.reply(`Auto-download: ${choice ? 'Enabled' : 'Disabled'}`);
    }

    let url = args.find(arg => /^https?:\/\//.test(arg));
    
    if (!url && event.type === "message_reply") {
      const replyBody = event.messageReply.body;
      const match = replyBody.match(/https?:\/\/[^\s]+/);
      if (match) url = match[0];
    }

    if (!url) return message.reply('Please provide or reply to a valid link.');

    const domain = getMainDomain(url);
    if (!supportedDomains.some(d => d.domain === domain)) {
      return message.reply('Unsupported platform.');
    }

    message.reaction('⏳', event.messageID);
    
    const result = await tryAllApis(url);
    if (!result) {
      message.reaction('❌', event.messageID);
      return message.reply('All APIs failed. Please try another link.');
    }

    await downloadAndSend({
      url,
      result,
      sendMessage: (msg, tid) => message.reply(msg, tid),
      threadID: event.threadID,
      messageID: event.messageID,
      setReaction: (emoji, mid, cb, async) => message.reaction(emoji, mid)
    });
  },

  onChat: async function ({ api, event, message, threadsData }) {
    if (event.senderID === api.getCurrentUserID()) return;
    
    const url = event.body?.match(/https?:\/\/[^\s]+/)?.[0];
    if (!url) return;

    const threadData = await threadsData.get(event.threadID);
    if (threadData?.data?.autoDownload === false) return;

    const prefix = await global.utils.getPrefix(event.threadID);
    if (event.body.startsWith(prefix)) return;

    const domain = getMainDomain(url);
    if (!supportedDomains.some(d => d.domain === domain)) return;

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      if (downloadCache.has(url)) {
        const cachedFile = downloadCache.get(url);
        if (fs.existsSync(cachedFile)) {
          await api.sendMessage(
            { attachment: fs.createReadStream(cachedFile) },
            event.threadID
          );
          return api.setMessageReaction("♻", event.messageID, () => {}, true);
        } else {
          downloadCache.delete(url);
        }
      }

      const result = await tryAllApis(url);
      
      if (!result) {
        throw new Error("All APIs failed");
      }

      await downloadAndSend({
        url,
        result,
        sendMessage: (msg, tid) => api.sendMessage(msg, tid),
        threadID: event.threadID,
        messageID: event.messageID,
        setReaction: (emoji, mid, cb, async) => api.setMessageReaction(emoji, mid, cb, async)
      });

    } catch (err) {
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      console.log("AutoDown Error:", err.message);
      api.sendMessage("Download failed. Please try another link.", event.threadID);
    }
  }
};
