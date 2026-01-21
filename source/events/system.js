import fs from "fs";
import path from "path";

const TARGET_FILE = path.join(process.cwd(), "./source/message.js"); 
const BACKUP_FILE = path.join(process.cwd(), "./source/message.js.bak");

const createBackup = () => {
    try {
        const content = fs.readFileSync(TARGET_FILE);
        fs.writeFileSync(BACKUP_FILE, content);
        return true;
    } catch (error) {
        throw new Error(`[SYSTEM_FAILURE] Backup Failed: ${error.message}`);
    }
};

const Case = {
    get: (name) => {
        let content = fs.readFileSync(TARGET_FILE, "utf8");
        
        let regex = new RegExp(`case\\s+["'\`]${name}["'\`]\\s*:`);
        let match = content.match(regex);
        
        if (!match) throw new Error(`[404] Case "${name}" not found in database.`);
        
        let startIdx = match.index;
        let braceStart = content.indexOf("{", startIdx);
        
        if (braceStart === -1) throw new Error(`[SYNTAX_ERROR] Case "${name}" has no opening brace '{'.`);

        let i = braceStart + 1;
        let stack = 1; 
        while (stack > 0 && i < content.length) {
            if (content[i] === "{") stack++;
            else if (content[i] === "}") stack--;
            i++;
        }
        
        return content.slice(startIdx, i);
    },

    add: (code) => {
        if (!code.includes("case")) throw new Error("[VIOLATION] Code must contain 'case' keyword.");
        if (!code.includes("{") || !code.includes("}")) throw new Error("[VIOLATION] Code block missing scope delimiters '{ }'.");
        if (!code.includes("break")) throw new Error("[VIOLATION] Switch-Case logic requires 'break' statement.");

        let content = fs.readFileSync(TARGET_FILE, "utf8");

        let caseNameMatch = code.match(/case\s+["'`](.*?)["'`]\s*:/);
        if (caseNameMatch) {
            let caseName = caseNameMatch[1];
            let checkRegex = new RegExp(`case\\s+["'\`]${caseName}["'\`]\\s*:`);
            if (checkRegex.test(content)) {
                throw new Error(`[CONFLICT] Case "${caseName}" already exists in the system.`);
            }
        }

        let anchorPoint = content.lastIndexOf("default:");
        if (anchorPoint === -1) {
            anchorPoint = content.lastIndexOf("}");
            if (anchorPoint === -1) throw new Error("[FATAL] Malformed file structure. Cannot find insertion point.");
        }

        createBackup();
        
        let newContent = content.slice(0, anchorPoint) + 
                         "\n  // [INJECTED BY SYSTEM]\n  " + 
                         code.trim() + 
                         "\n\n  " + 
                         content.slice(anchorPoint);
        
        fs.writeFileSync(TARGET_FILE, newContent);
        return true;
    },

    delete: (name) => {
        let content = fs.readFileSync(TARGET_FILE, "utf8");
        
        let regex = new RegExp(`case\\s+["'\`]${name}["'\`]\\s*:`);
        let match = content.match(regex);
        
        if (!match) throw new Error(`[404] Case "${name}" not found.`);

        let startIdx = match.index;
        let braceStart = content.indexOf("{", startIdx);
        
        if (braceStart === -1) throw new Error(`[SYNTAX_ERROR] Malformed case block.`);

        let i = braceStart + 1;
        let stack = 1;
        while (stack > 0 && i < content.length) {
            if (content[i] === "{") stack++;
            else if (content[i] === "}") stack--;
            i++;
        }

        createBackup();

        let newContent = content.slice(0, startIdx) + content.slice(i);
        
        newContent = newContent.replace(/\n\s*\n\s*\n/g, "\n\n");

        fs.writeFileSync(TARGET_FILE, newContent);
        return true;
    },

    list: () => {
        let content = fs.readFileSync(TARGET_FILE, "utf8");
        let regex = /case\s+["'`](.*?)["'`]\s*:/g;
        let matches;
        let cases = [];
        
        while ((matches = regex.exec(content)) !== null) {
            cases.push(matches[1]);
        }
        
        return {
            count: cases.length,
            data: cases
        };
    },

    restore: () => {
        if (!fs.existsSync(BACKUP_FILE)) throw new Error("[RECOVERY_FAILED] No backup file found.");
        let backupContent = fs.readFileSync(BACKUP_FILE);
        fs.writeFileSync(TARGET_FILE, backupContent);
        return true;
    }
};

export default Case;