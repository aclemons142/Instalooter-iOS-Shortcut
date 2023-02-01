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
const IS_LOCAL = os.hostname().indexOf(".local") !== -1;
const HOST = IS_LOCAL ? `http://localhost:${PORT}` : `http://${EXT_HOST}`

// Main
let Looter = {
    VideoId: null,
    GetYoutubeShort: async url => {
        let id = ytdl.getURLVideoID(url);
        let path = `${YOUTUBE_PATH}/${id}.mp4`;
        let out = fs.createWriteStream(path);
        let savePath = `${HOST}/youtube/${id}.mp4`;
        let result = new Promise( (resolve, reject) => {
            let res = ytdl(url).pipe(out);
            res.on('finish', () => {
                console.log(`You have successfully created a video`);
                resolve(savePath);
            });
            res.on('error', (err) => {
                console.log(`Error: ${error.message}`);
                reject(err)
            });
        });
        setTimeout(() => {
            Looter.CleanVideoFile(path);
        }, 60000);
        return await result;
    },
    CleanVideoFile: filename => {
        fs.rmSync(filename);
    },
    GetInstagramVideo: async url => {
        Looter.VideoId = Looter.ExtractInstagramId(url);
        var links = await instagramGetUrl(`https://www.instagram.com/tv/${Looter.VideoId}/`)
        if (!links || (links && links.results_number == 0)) return null;
        let theLink = links.url_list[0];
        if (new URL(decodeURI(theLink)).hostname.indexOf("converter") !== -1) {
            theLink = theLink.split("&filename")[0]
        }
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
        return await promise;
    },
    ExtractInstagramId: url => {
        url = url.split("https://www.instagram.com/reel/")[1];
        if (url.indexOf("/")) url = url.split("/")[0];
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
function DetermineServiceByUrl(url) {
    let host = new URL(url).hostname;
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
        default: return null
    }
}

app.use('/youtube', express.static('youtube'))

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