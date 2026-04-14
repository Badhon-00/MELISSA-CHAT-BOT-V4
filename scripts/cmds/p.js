module.exports = { 
  config: { 
    name: "p", 
    version: "3.1", 
    author: "Badhon", 
    countDown: 5, 
    role: 2, 
    shortDescription: { vi: "", en: "Manage pending group requests" }, 
    longDescription: { vi: "", en: "Approve or cancel pending group requests with Tufa Bot" }, 
    category: "admin" 
  },

  langs: { 
    en: { 
      invalidNumber: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗘𝗥𝗥𝗢𝗥 🎀 ───\n│\n├ ❌ 『%1』 is not a valid number!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───",
      cancelSuccess: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗢𝗣𝗘𝗥𝗔𝗧𝗜𝗢𝗡 🎀 ───\n│\n├ 🚫 Refused 『%1』 thread(s)!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───",
      approveSuccess: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗢𝗣𝗘𝗥𝗔𝗧𝗜𝗢𝗡 🎀 ───\n│\n├ ✅ Approved 『%1』 thread(s)!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───",
      cantGetPendingList: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗘𝗥𝗥𝗢𝗥 🎀 ───\n│\n├ 💢 Unable to retrieve pending list!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───",
      returnListClean: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 🎀 ───\n│\n├ ✅ No pending requests found!\n├ 🌟 All clear and up to date!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───",
      approveAllSuccess: "┌─── 🎀 𝗧𝗨𝗙𝗔 𝗢𝗣𝗘𝗥𝗔𝗧𝗜𝗢𝗡 🎀 ───\n│\n├ 🌠 Successfully approved ALL 『%1』 threads!\n│\n├ ⚠️  If any problem, contact: SOHAN\n│\n└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───"
    } 
  },

  getBangladeshTime() {
    const now = new Date();
    const bangladeshOffset = 6 * 60;
    const localOffset = now.getTimezoneOffset();
    const t = new Date(now.getTime() + (localOffset + bangladeshOffset) * 60000);

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    return {
      date: `${String(t.getDate()).padStart(2,'0')}/${String(t.getMonth()+1).padStart(2,'0')}/${t.getFullYear()}`,
      time: `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`,
      day: days[t.getDay()]
    };
  },

  onReply: async function ({ api, event, Reply, getLang }) {
    if (event.senderID != Reply.author) return;

    const bangladeshTime = this.getBangladeshTime();
    let approverName = "Admin";

    try {
      const u = await api.getUserInfo(event.senderID);
      approverName = u[event.senderID]?.name || "Admin";
    } catch {}

    const body = event.body.toLowerCase();
    const isAll = body === "-all";
    const isCancel = body.startsWith("c");
    const list = isAll ? Reply.pending.map((_,i)=>i+1) : body.replace(/^c\s*/,"").split(/\s+/);

    let count = 0;

    for (const i of list) {
      const num = parseInt(i);
      if (!isAll && (isNaN(num) || num < 1 || num > Reply.pending.length))
        return api.sendMessage(getLang("invalidNumber", i), event.threadID);

      const group = Reply.pending[num-1];
      if (isCancel) {
        api.removeUserFromGroup(api.getCurrentUserID(), group.threadID);
      } else {
        const prefix = global.utils.getPrefix(group.threadID);
        api.sendMessage(
`┌─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───
│
├ 🤖 TUFA BOT successfully activated!
├ 📛 Group: ${group.name}
├ ⚡ Prefix: ${prefix}
├ 👤 Approved By: ${approverName}
├ 📅 Date: ${bangladeshTime.date}
├ 🕐 Time: ${bangladeshTime.time}
├ 📆 Day: ${bangladeshTime.day}
│
└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───`,
          group.threadID
        );
      }
      count++;
    }

    return api.sendMessage(
      isAll ? getLang("approveAllSuccess", count)
      : isCancel ? getLang("cancelSuccess", count)
      : getLang("approveSuccess", count),
      event.threadID
    );
  },

  onStart: async function ({ api, event, getLang, commandName }) {
    const bangladeshTime = this.getBangladeshTime();
    let adminName = "Admin";

    try {
      const u = await api.getUserInfo(event.senderID);
      adminName = u[event.senderID]?.name || "Admin";
    } catch {}

    try {
      const spam = await api.getThreadList(100, null, ["OTHER"]);
      const pending = await api.getThreadList(100, null, ["PENDING"]);
      const list = [...spam, ...pending].filter(g => g.isGroup && g.isSubscribed);

      if (!list.length)
        return api.sendMessage(getLang("returnListClean"), event.threadID);

      let msg = "";
      list.forEach((g,i)=>{
        msg += `├ ➤ ${i+1}. ${g.name}\n│\n`;
      });

      return api.sendMessage(
`┌─── 🎀 𝗧𝗨𝗙𝗔 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 🎀 ───
│
├ 👤 Admin: ${adminName}
├ 📊 Total: ${list.length}
├ 📅 Date: ${bangladeshTime.date}
├ 🕐 Time: ${bangladeshTime.time}
├ 📆 Day: ${bangladeshTime.day}
│
${msg}
├ ➤ Approve: 1 2
├ ➤ Cancel: c 1 2
├ ➤ Approve All: -all
│
└─── 🎀 𝗧𝗨𝗙𝗔 𝗕𝗢𝗧 🎀 ───`,
        event.threadID,
        (err,info)=>{
          global.GoatBot.onReply.set(info.messageID,{
            commandName,
            author: event.senderID,
            pending: list
          });
        }
      );
    } catch {
      return api.sendMessage(getLang("cantGetPendingList"), event.threadID);
    }
  }
};
