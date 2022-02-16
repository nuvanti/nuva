import { ensureDir } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

function getBinDir() {
    const homeDir = Deno.env.get("HOME")!;
    return join(homeDir, ".nuva", "bin");
}

function isWindows() {
    return Deno.build.os === "windows";
}

/** 
 * splits string by words, but preserving double quoted strings togeteher 
 * ref: https://stackoverflow.com/questions/2817646/javascript-split-string-on-space-or-on-quotes-to-array
*/
function tokenize(s: string): string[] {
    return (s.match(/[^\s"]+|"([^"]*)"/gi) || [])
        .map(w => w[0] === '"' ? w.slice(1, -1) : w);
}

async function runCmd(cmd: string) {
    const proc = Deno.run({
        cmd: tokenize(cmd),
        stdout: 'piped',
        stderr: 'piped',
    });
    const status = await proc.status();
    const rawOutput = await proc.output()
    const rawStderrOutput = await proc.stderrOutput();
    let output = new TextDecoder().decode(rawOutput);
    output += '\n' + new TextDecoder().decode(rawStderrOutput);
    proc.close();
    return {
        success: status.success,
        output: output
    }
}

async function unzip(zipFile: string, unzipDir: string) {
    let unzipResult;
    if (isWindows()) {
        unzipResult = await runCmd(`powershell expand-archive ${zipFile} ${unzipDir}`);
    } else {
        unzipResult = await runCmd(`unzip ${zipFile} -d ${unzipDir}`);
    }
    if (!unzipResult.success) {
        throw new Error(`error when unzipping nuva zip file: ${unzipResult.output}`)
    }
}

function getFileName() {
    const os = Deno.build.os;
    const arch = Deno.build.arch;
    if (os === "windows" && arch === "x86_64") {
        return `nuva.windows.zip`;
    } else if (os === "darwin" && arch === "aarch64") {
        return `nuva.mac.m1.zip`;
    } else if (os === "linux" && arch === "x86_64") {
        return `nuva.linux.zip`
    }
    throw new Error("unsupported operating system and architecture");
}


async function downloadZip() {
    const dir = getBinDir();
    await ensureDir(dir);
    const response = await fetch("https://raw.githubusercontent.com/nuvanti/nuva/main/latest.txt", { cache: "reload" });
    const version = await response.text();
    console.log(`downloading nuva version: ${version}`);
    const fileUrl = `https://github.com/nuvanti/nuva/releases/download/${version}/${getFileName()}`
    console.log(fileUrl);
    const data = (await fetch(fileUrl)).arrayBuffer();
    const filePath = join(dir, "nuva.zip");
    await Deno.writeFile(filePath, new Uint8Array(await data))
    console.log("successfully downloaded zip file");
    await unzip(filePath, dir);
    console.log("nuva successfully installed. Please add $HOME/.nuva/bin to your path:");
}

//console.log(`installing nuva for ${Deno.build.os}:${Deno.build.arch}`);

await downloadZip();

