"use strict";

const logElement = document.getElementById("log");
const logOuterElement = document.getElementById("log-outer");
const optionsElement = document.getElementById("options");

var baseFw = null;
var patchConfig = null;
var patchBin = null;
var patchMap = {};
var patchFont = null;

function log(string) {
    logElement.innerText += string + "\n"
    logOuterElement.scrollTop = logOuterElement.scrollHeight;
}

async function fetchWrapped(url) {
    let req = await fetch(url + `?${Date.now()}`);
    if (req.status !== 200)
        throw new Error(`Server returned "${fwFetch.statusText}"`);
    return req;
}

async function fetchText(url) {
    return (await fetchWrapped(url)).text();
}

async function fetchBin(url) {
    return (await fetchWrapped(url)).arrayBuffer();
}

function encode_u32le(num) {
    return [
        num & 0xFF,
        (num >> 8) & 0xFF,
        (num >> 16) & 0xFF,
        (num >> 24) & 0xFF,
    ]
}

function encode_branch(opcode, src, dst) {
    let offset = dst - src;
    if (offset < -(1 << 20) || offset > (1 << 20) - 1)
        throw new Error("Jump is too large");
    offset &= (1 << 21) - 1;
    return encode_u32le(opcode | (offset & 0xFF000) | ((offset & 0x800) << 9) | ((offset & 0x7FE) << 20) | ((offset & 0x100000) << 11))
}

function resolve_addr(addr) {
    if (addr.startsWith("0x")) {
        return parseInt(addr);
    } else {
        let result = patchMap[addr];
        if (result == undefined)
            throw new Error(`Failed to resolve addr ${addr}`);
        return result;
    }
}

function resolve_data(addr, data) {
    if (data.startsWith("!")) {
        const split = data.split(":");
        switch (split[0]) {
            case "!j":
                return encode_branch(0x6F, addr, resolve_addr(split[1]));
            case "!jal_ra":
                return encode_branch(0xEF, addr, resolve_addr(split[1]));
            case "!nop":
                return encode_u32le(0x13);
            case "!main":
                return patchBin;
            case "!ptr":
                return encode_u32le(resolve_addr(split[1]));
            case "!font":
                return patchFont;
            default:
                throw new Error(`Failed to resolve data ${data}`);
        }
    } else {
        const result = new Uint8Array(data.length >> 1);
        for (let i = 0; i < data.length; i += 2)
            result[i >> 1] = parseInt(data.substr(i, 2), 16);
        return result;
    }
}

// By this point I've given up on trying to write garbage JS on my own
// https://stackoverflow.com/questions/71567222/how-to-use-crypto-js-to-save-the-binary-data-of-an-encryption-output-to-a-file
function convertWordArrayToUint8Array(wordArray) {
    var arrayOfWords = wordArray.hasOwnProperty("words") ? wordArray.words : [];
    var length = wordArray.hasOwnProperty("sigBytes") ? wordArray.sigBytes : arrayOfWords.length * 4;
    var uInt8Array = new Uint8Array(length), index=0, word, i;
    for (i=0; i<length; i++) {
        word = arrayOfWords[i];
        uInt8Array[index++] = word >> 24;
        uInt8Array[index++] = (word >> 16) & 0xff;
        uInt8Array[index++] = (word >> 8) & 0xff;
        uInt8Array[index++] = word & 0xff;
    }
    return uInt8Array;
}

// https://stackoverflow.com/questions/23451726/saving-binary-data-as-file-using-javascript-from-a-browser/23451803#23451803
var saveByteArray = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, name) {
        var blob = new Blob(data, {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

async function init() {
    try {
        log("Downloading latest patch config...");
        patchConfig = JSON.parse(await fetchText("patches.json"));
        for (const [id, data] of Object.entries(patchConfig["options"])) {
            switch (data["type"]) {
                case "checkbox": {
                    let checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = data["value"];
                    data["checkbox"] = checkbox;

                    let label = document.createElement("label");
                    label.innerText = " " + data["name"];

                    label.prepend(checkbox);
                    optionsElement.appendChild(label);
                    break;
                }
                case "font_dropdown": {
                    let dropdown = document.createElement("select");
                    data["dropdown"] = dropdown;

                    for (const [id, data] of Object.entries(patchConfig["fonts"])) {
                        let option = document.createElement("option");
                        option.value = id;
                        option.innerText = id;
                        dropdown.appendChild(option);
                    }

                    const scale = 2;
                    let canvas = document.createElement("canvas");
                    canvas.width = 16 * 8 * scale;
                    canvas.height = 6 * 16 * scale;

                    dropdown.addEventListener("change", () => {
                        patchFont = resolve_data(0, patchConfig["fonts"][dropdown.value]["data"]);

                        let ctx = canvas.getContext("2d");
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.fillStyle = "white";
                        for (var i = 0; i < 94; i++) {
                            const x_off = i % 16 * 8;
                            const y_off = Math.floor(i / 16) * 16;
                            for (var row = 0; row < 16; row++) {
                                var byte = patchFont[i * 16 + row];
                                for (var col = 0; col < 8; col++) {
                                    if (byte & 1)
                                        ctx.fillRect((x_off + col) * scale, (y_off + row) * scale, scale, scale);
                                    byte >>= 1;
                                }
                            }
                        }
                    });
                    dropdown.dispatchEvent(new Event("change"));

                    let label = document.createElement("label");
                    label.innerText = data["name"] + ": ";

                    label.append(dropdown);
                    optionsElement.appendChild(label);
                    optionsElement.appendChild(document.createElement("br"));
                    optionsElement.appendChild(canvas);
                    break;
                }
                default:
                    throw new Error(`Unhandled option type "${data["type"]}"`);
            }
            optionsElement.appendChild(document.createElement("br"));
        }
        log(`Target firmware: ${patchConfig["target_fw_str"]} (${patchConfig["target_fw"]})`);

        log("Downloading base firmware...");
        baseFw = await fetchBin(`app_O3C_${patchConfig["target_fw"]}_dec.bin`);

        log("Downloading patch binary...");
        patchBin = new Uint8Array(await fetchBin("main.bin"));

        log("Downloading patch map file...");
        let mapFile = await fetchText("main.map");
        const regex = / {16}0x([0-9a-z]{16})\s+([A-Za-z_][A-Za-z0-9_]+)/g;
        for (let result = regex.exec(mapFile); result; result = regex.exec(mapFile))
            patchMap[result[2]] = parseInt(result[1], 16);
        if (patchMap["target_fw"] != patchConfig["target_fw"])
            throw new Error(`Target firmware mismatch (map: ${patchMap["target_fw"]}, patch: ${patchConfig["target_fw"]})`);

        log("Ready to build!");
        document.getElementById("build-button").disabled = false;
    } catch (e) {
        log(`\n${e.stack}`);
    }
}

async function build() {
    document.getElementById("build-button").disabled = true;
    try {
        
        log("\nBuilding...");
        let fw = new Uint8Array(baseFw);
        function patch(addr, data) {
            for (let i = 0; i < data.length; i++)
                fw[addr + i - 0x4000] = data[i];
        }
        for (const [id, data] of Object.entries(patchConfig["options"])) {
            switch (data["type"]) {
                case "checkbox": {
                    data["value"] = data["checkbox"].checked;
                    break;
                }
                case "font_dropdown": {
                    data["value"] = data["dropdown"].value !== "Stock";
                    break;
                }
                default:
                    throw new Error(`Unhandled option type "${data["type"]}"`);
            }
        }

        for (const [name, data] of Object.entries(patchConfig["patches"])) {
            if (data["enable_if"] === undefined || patchConfig["options"][data["enable_if"]]["value"]) {
                log(`Applying patch: ${name}`);
                const addr = resolve_addr(data["addr"]);
                const content = resolve_data(addr, data["data"]);
                patch(addr, content);
            }
        }

        log("Encrypting...");
        let encrypted = CryptoJS.AES.encrypt(
            CryptoJS.lib.WordArray.create(fw),
            CryptoJS.enc.Hex.parse("C4053DDF225E89F74868C1E1F4C00D514F02A8A8692F997869ABEB155250150C"),
            {
                iv: CryptoJS.enc.Hex.parse("00"),
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.NoPadding,
            }
        );
        saveByteArray([convertWordArrayToUint8Array(encrypted.ciphertext)], "app_O3C.bin");

        log("Done!");
    } catch (e) {
        log(`\n${e.stack}`);
    }
    document.getElementById("build-button").disabled = false;
}

init();
