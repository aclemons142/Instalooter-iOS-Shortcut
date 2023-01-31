// Instalooter

// Example links:
// "https://giphy.com/gifs/cny-lunar-yeremiaas-7o16UGO32fgid6PAf0";
// "https://giphy.com/clips/buzzfeed-irish-americans-try-to-pronounce-traditional-names-Dcl0XM9i4FRWiFMFWb";
// "https://www.instagram.com/reel/CnvhkMHDpAY/?utm_source=ig_web_copy_link";

// Services & Imports
const giphy = require('giphy')('AMaXOQk7i8gRouAjHjjSoE8TJdtCKk3j');
const instagramGetUrl = require("instagram-url-direct");
const express = require("express");
const app = express();
const bodyParser = require('body-parser');


// Consts
const PORT = process.env.PORT || 3000;
const parser = bodyParser.json();
const TRUST_CODE = "egUt1aahXi7lU6ps";

// Main
let Looter = {
    VideoId: null,
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
}

async function GetVideoUrl(url) {
    if (!url) return null;
    switch (DetermineServiceByUrl(url)) {
        case "INSTAGRAM": return await Looter.GetInstagramVideo(url)
        case "GIPHY": return await Looter.GetGiphyVideo(url)
        default: return null
    }
}

app.use("*", async (req, res, next) => {
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