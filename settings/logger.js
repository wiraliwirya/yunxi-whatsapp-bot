import colors from './colors.js';

const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { hour12: false });
};

const createCenteredBox = (text, width = 50, color = colors.green) => {
    const padding = Math.max(0, width - text.length - 2);
    const padLeft = Math.floor(padding / 2);
    const padRight = padding - padLeft;
    
    const border = '─'.repeat(width);
    const spacesLeft = ' '.repeat(padLeft);
    const spacesRight = ' '.repeat(padRight);

    return {
        top: `${color}┌${border}┐${colors.reset}`,
        middle: `${color}│${colors.reset}${spacesLeft}${colors.bright}${text}${colors.reset}${spacesRight}${color}│${colors.reset}`,
        bottom: `${color}└${border}┘${colors.reset}`
    };
};

export const logHeader = (title) => {
    const box = createCenteredBox(title.toUpperCase(), 48, colors.green);
    console.log(''); 
    console.log(box.top);
    console.log(box.middle);
    console.log(box.bottom);
    console.log('');
};

export const logFooter = () => {
    console.log(`${colors.green}──────────────────────────────────────────────────${colors.reset}\n`);
};

export const logIncomingMessage = (logSender, logType, messageBody, isGroup) => {
    const time = getTimestamp();
    const groupIcon = isGroup ? `[G]` : `[P]`; 
    const senderColor = isGroup ? colors.magenta : colors.cyan;

    console.log(`${colors.gray}┌── ${time} ──────────────────────────────${colors.reset}`);
    console.log(`${colors.gray}│ ${colors.bright}${colors.info}[IN] ${groupIcon} ${senderColor}${logSender}${colors.reset} ${colors.gray}(${logType})${colors.reset}`);
    
    const displayBody = messageBody.length > 200 ? messageBody.substring(0, 200) + '...' : messageBody;
    console.log(`${colors.gray}│ ${colors.reset}"${displayBody}"`);
    console.log(`${colors.gray}└─────────────────────────────────────────────${colors.reset}`);
};

export const logNonCommand = (messageBody) => {
    console.log(`${colors.gray}[~] ${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}${colors.reset}`);
};

export const logCommandDetection = (command, args) => {
    const time = getTimestamp();
    console.log(`${colors.bright}${colors.magenta}[CMD] ${command} ${colors.reset}${colors.gray}| Args: [${args}] | ${time}${colors.reset}`);
};

export const logCommandStatus = (status, command) => {
    const time = getTimestamp();
    let prefix = '';
    let msg = '';

    switch (status) {
        case 'running':
            prefix = `${colors.yellow}[...]`;
            msg = `Memproses: ${command}`;
            break;
        case 'success':
            prefix = `${colors.green}[OK ]`;
            msg = `Sukses eksekusi: ${command}`;
            break;
        case 'notfound':
            prefix = `${colors.red}[404]`;
            msg = `Perintah tidak dikenal: ${command}`;
            break;
        default:
            prefix = `${colors.gray}[???]`;
            msg = command;
    }

    console.log(`${prefix} ${msg} ${colors.gray}@ ${time}${colors.reset}`);
};

export const logWarning = (message) => {
    const time = getTimestamp();
    console.log(`${colors.warning}[WARN] ${time} | ${message}${colors.reset}`);
};

export const logError = (message, error) => {
    const time = getTimestamp();
    console.log(`${colors.error}┌── [ERROR] ${time} ──────────────────────────${colors.reset}`);
    console.log(`${colors.error}│ Msg : ${message}${colors.reset}`);
    if (error) {
        const errString = error.stack || error.toString();
        console.log(`${colors.error}│ Stack: ${colors.gray}${errString.split('\n')[0]}${colors.reset}`); 
    }
    console.log(`${colors.error}└─────────────────────────────────────────────${colors.reset}`);
};

export const logLimitInfo = (message) => {
    console.log(`${colors.cyan}[INFO] ${message}${colors.reset}`);
};

export const logLimitBlocked = (message) => {
    console.log(`${colors.bright}${colors.red}[BLOCKED] ${message}${colors.reset}`);
};