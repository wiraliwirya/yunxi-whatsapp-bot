import fs from "fs";
import chalk from "chalk";

global.owner = [
  "6283879152564", 
  "6283879152564@s.whatsapp.net"
]; 

global.mode = "public";
global.nameown = "Liwirya"; 
global.namebotz = "Yunxi Assistant";  
global.packname = "Stiker by Yunxi Assistant";  
global.author = "Punya Kesayangan Liwirya";
global.footer = "© Yunxi Assistant";

global.socials = {
  youtube: "https://www.youtube.com/-",
  github: "https://github.com/liwirya",
  telegram: "https://t.me/liwirya",
  whatsapp_channel: "https://whatsapp.com/channel/0029VadHRVCEQIagiLHVJV0d"
};

global.YouTube = global.socials.youtube;
global.GitHub = global.socials.github;
global.Telegram = global.socials.telegram;
global.ChannelWA = global.socials.whatsapp_channel;

global.mess = {
  wait: "_Sabar elah, lagi gw proses nih..._",
  success: "_Udah kelar noh. Jangan lupa bilang makasih!_",  
  group: "*Woi Kocak!*\nFitur ini cuma bisa dipake di *Grup*. Ngapain lu coba di japri?",
  admin: "*Sadar Diri*\nLu bukan *Admin*, gausah nyuruh-nyuruh gw. Minimal jadi admin dulu lah.",
  owner: "*Lu Siapa?*\nFitur ini khusus Owner gw. Lu minggir dulu.",
  botadmin: "*Gw Bukan Admin*\nJadiin gw *Admin* dulu lah woi, baru bisa kerja!",
  
  error: "_Dahlah error, pusing gw. Coba lagi ntar ya._"
};

let file = import.meta.url.substring(7);

fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.greenBright(`🔄 Config ${path.basename(file)} ke-update otomatis!`));
  import(`${file}?update=${Date.now()}`);
});