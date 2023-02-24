// Instalooter

// Example links:
// "https://giphy.com/gifs/cny-lunar-yeremiaas-7o16UGO32fgid6PAf0";
// "https://giphy.com/clips/buzzfeed-irish-americans-try-to-pronounce-traditional-names-Dcl0XM9i4FRWiFMFWb";
// "https://www.instagram.com/reel/CnvhkMHDpAY/?utm_source=ig_web_copy_link";
// "https://www.youtube.com/shorts/e8wqWpEkbWQ"

// Services & Imports
const giphy = require('giphy')('AMaXOQk7i8gRouAjHjjSoE8TJdtCKk3j');
const instagramGetUrl = require("instagram-url-direct");
const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const path = require('node:path');
const fs = require('fs');
const os = require('os');

// Consts
const PORT = process.env.PORT || 3000;
const parser = bodyParser.json();
const TRUST_CODE = "egUt1aahXi7lU6ps";
const EXT_HOST = "instalooter.us-3.evennode.com"
const YOUTUBE_PATH = path.resolve("./youtube");
const WEBM_PATH = path.resolve("./webm");
const IS_LOCAL = os.hostname().indexOf(".local") !== -1;
const HOST = IS_LOCAL ? `http://localhost:${PORT}` : `http://${EXT_HOST}`;
const FILE_DELETE_TIMEOUT = 300000;

// ffmpeg Support
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');
const ffmpeg = createFFmpeg({ log: true });

// Main
let Looter = {
    VideoId: null,
    GetYoutubeShort: async url => {
        // Assign video ID
        Looter.VideoId = ytdl.getURLVideoID(url);
        
        // Setup paths and streams
        let path = `${YOUTUBE_PATH}/${Looter.VideoId}.mp4`;
        let out = fs.createWriteStream(path);
        let savePath = `${HOST}/youtube/${Looter.VideoId}.mp4`;

        // Get readStream from ytdl and save as writeSteam to the filepath
        let result = new Promise( (resolve, reject) => {
            let res = ytdl(url).pipe(out);
            res.on('finish', () => resolve(savePath));
            res.on('error', (err) => {
                console.log(`Error: ${error.message}`);
                reject(err)
            });
        });

        // Remove the file after time has passed
        setTimeout(() => Looter.CleanVideoFile(path), FILE_DELETE_TIMEOUT);

        // Log success message
        Looter.LogSuccess(url);

        // Return the result
        return await result;
    },
    GetConvertWebm: async url => {
        // Assign video ID
        Looter.VideoId = Looter.ExtractFilename(url);

        // Input and output filenames
        let inputFileName = `${Looter.VideoId}.webm`;
        let outputFileName = `${Looter.VideoId}.mp4`;

        // Paths
        let outPath = `${WEBM_PATH}/${outputFileName}`;
        let webPath = `${HOST}/webm/${outputFileName}`;

        // Spool up ffmpeg client
        await ffmpeg.load();

        // Fetch WEBM and write file to virtual file store
        ffmpeg.FS('writeFile', inputFileName, await fetchFile(url));

        // Run ffmpeg
        await ffmpeg.run('-fflags', '+genpts', '-i', inputFileName, '-r', '24', outputFileName);

        // Write output file to actual filesysytem
        await fs.promises.writeFile(outPath, ffmpeg.FS('readFile', outputFileName));
        
        // Remove the files after time has passed
        setTimeout(() => Looter.CleanVideoFile(outPath), FILE_DELETE_TIMEOUT);

        // Log success message
        Looter.LogSuccess(url);

        return webPath

    },
    ExtractFilename: url => {
        if (!url) return null;
        url = new URL(url);
        let pathParts = url.pathname.split("/");
        let fileId = pathParts[pathParts.length - 1].split(".")[0];
        return fileId;
    },
    CleanVideoFile: filename => {
        fs.rmSync(filename);
        console.log(`Removing ${filename}`);
    },
    LogSuccess: url => {
        let today = new Date();
        let timestamp = `${today.toLocaleDateString()} at ${today.toLocaleTimeString()}`;
        console.log(`\n ${timestamp} - URL ${url}: Converted successfully to downloadable asset\n`);
    },
    GetInstagramVideo: async url => {
        Looter.VideoId = Looter.ExtractInstagramId(url);
        if (!Looter.VideoId) return null;
        var links = await instagramGetUrl(`https://www.instagram.com/tv/${Looter.VideoId}/`)
        if (!links || (links && links.results_number == 0)) return null;
        let theLink = links.url_list[0];
        if (new URL(decodeURI(theLink)).hostname.indexOf("converter") !== -1) {
            theLink = theLink.split("&filename")[0]
        }
        Looter.LogSuccess(url);
        return theLink;
    },
    GetGiphyVideo: async url => {
        Looter.VideoId = Looter.ExtractGiphyId(url);
        let promise = new Promise((resolve, reject) => {
            giphy.gifs({ ids: [Looter.VideoId] }, (err, response) => {
                if (err) reject(err);
                let media = response.data[0];
                let url = media.type === 'video' ? Looter.GetBestGiphyVideoQuality(media.video.assets) : media.images.original_mp4.mp4;
                if (url.indexOf("?") !== -1) url = url.split("?")[0];
                resolve(url)
            })
        })
        Looter.LogSuccess(url);
        return await promise;
    },
    ExtractInstagramId: url => {
        url = url.split("https://www.instagram.com/reel/")[1];
        if (url && url.indexOf("/")) url = url.split("/")[0];
        return url;
    },
    ExtractGiphyId: url => {
        url = new URL(url);
        let id = url.pathname.split("-").slice(-1).pop();
        return id;
    },
    GetBestGiphyVideoQuality: assets => {
        if (!Object.keys(assets).length) return null;
        if (assets.hasOwnProperty("1080p")) return assets["1080p"].url;
        if (assets.hasOwnProperty("720p")) return assets["720p"].url;
        if (assets.hasOwnProperty("480p")) return assets["480p"].url;
        return null;
    }
}

// Utility functions
function DetermineServiceByUrl(u) {
    let url = new URL(u);
    let host = url.hostname;
    let path = url.pathname;

    if (path.endsWith(".webm")) return "WEBM";
    if (host.indexOf("instagram.com") !== -1) return "INSTAGRAM";
    if (host.indexOf("giphy.com") !== -1) return "GIPHY";
    if (host.indexOf("youtube.com") !== -1) return "YOUTUBE";
}

async function GetVideoUrl(url) {
    if (!url) return null;
    switch (DetermineServiceByUrl(url)) {
        case "INSTAGRAM": return await Looter.GetInstagramVideo(url)
        case "GIPHY": return await Looter.GetGiphyVideo(url)
        case "YOUTUBE": return await Looter.GetYoutubeShort(url)
        case "WEBM": return await Looter.GetConvertWebm(url)
        default: return null
    }
}

// Static paths for downloads
app.use('/youtube', express.static('youtube'))
app.use('/webm', express.static('webm'))

app.post("*", async (req, res, next) => {
    if (!req.headers.hasOwnProperty("trustcode") || req.headers["trustcode"] !== TRUST_CODE) {
        return res.sendStatus(401);
    } else {
        next();
    }
})

// Primary route - POST
app.post("/link", parser, async (req, res) => {
    if (!req.body) return res.sendStatus(404);
    let { inbound } = req.body;
    let outbound = await GetVideoUrl(inbound);
    if (!outbound) return res.sendStatus(404);
    if (req.body.decode == 1) outbound = decodeURI(outbound);
    if (req.body.encode == 1) outbound = encodeURI(outbound);
    if (req.body.unescape == 1) outbound = unescape(outbound);
    if (req.body.escape == 1) outbound = escape(outbound);
    return res.json({ url: outbound });
});


// Start server
app.listen(PORT, () => console.log(`Instalooter running on Port ${PORT}...`))