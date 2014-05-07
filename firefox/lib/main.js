const pageMod = require("sdk/page-mod");
const data = require("sdk/self").data;
const tabs = require("sdk/tabs");
const Request = require('sdk/request').Request;
const prefSet = require('sdk/simple-prefs');
const widget = require('sdk/widget');
const panel = require('sdk/panel');
var {Cc, Ci} = require("chrome");

var whitelist = [/http:\/\/(www\.)?youtube\.com\/watch.*/, /.*\?arnoreplace=yes.*/];
var dropdownValues = [];
var description = "";
var adPanel = null;

function shouldFilter(url)
{
    if(!prefSet.prefs.enabled)
        return false;
    for(var i = 0; i < whitelist.length; i++)
    {
        if(whitelist[i].test(url))
            return false;
    }
    return true;
}

function getLinks()
{
    if(prefSet.prefs.endpoint.match)
    var linkRequest = Request({
        url: prefSet.prefs.endpoint + "/list.json",
        onComplete: function(response){
            if(response.status >= 400 || response.json === null)
            {
                //TODO: Feedback message
                //console.log("Invalid URL");
            }
            else
            {
                description = response.json.description;
                dropdownValues = response.json.links;
                
                if(adPanel)
                {
                    adPanel.port.emit("show", {
                        source: prefSet.prefs.endpoint,
                        enabled: prefSet.prefs.enabled,
                        description: description,
                        links: dropdownValues,
                        currentLink: prefSet.prefs.link
                    });
                }
            }
        }
    }).get();
}

prefSet.on("endpoint", function(){
    getLinks();
});

var selectors = [];

var selectorsRequest = Request({
    url: data.url("common/selectors.txt"),
    onComplete: function(response) {
        var lines = response.text.split("\n");
        lines.forEach(function(line) {
            if (line.substr(0,2) != '//' && line.trim().length) {
                selectors.push(line);
            }
        });

        //UI panel
        adPanel = panel.Panel({
            width: 300,
            height: 150,
            contentURL: data.url("settingspanel.html"),
            contentScriptFile: data.url("settings.js")
        });

        //UI widget
        var adWidget = widget.Widget({
            id: "ad-swap-widget",
            label: "Ad Swap",
            contentURL: data.url("common/icon-16.png"),
            panel: adPanel
        });

        var initPanel = function() {
            adPanel.port.emit("show", {
                source: prefSet.prefs.endpoint,
                enabled: prefSet.prefs.enabled,
                description: description,
                links: dropdownValues,
                currentLink: prefSet.prefs.link
            });
        };

        adPanel.on("show", initPanel);
        adPanel.on("refresh", initPanel);

        adPanel.port.on("sourcechange", function(data){
            prefSet.prefs.endpoint = data.source.replace(/\/$/, "");
        });

        adPanel.port.on("enabledchange", function(data){
            prefSet.prefs.enabled = data.enabled;
        });

        adPanel.port.on("linkchange", function(data){
            prefSet.prefs.link = data.link;
        });

        adPanel.port.on("closeclick", function(data){
            adPanel.hide();
        });

        //Ad filter
        pageMod.PageMod({
            include: /http:\/\/.*/,
            contentScriptWhen: "ready",
            contentScriptFile: [
                data.url("common/jquery.min.js"),
                data.url("common/adreplacer.js"),
                data.url("content.js")
            ],
            contentStyleFile: [
                data.url("common/content.css")
            ],
            onAttach: function(worker) {
                if(shouldFilter(worker.tab.url))
                {
                    worker.postMessage({'action': 'setSelectors', 'data': selectors});
                    worker.port.on("adRequest", function(data)
                    {
                        var adRequest = Request({
                            url: prefSet.prefs.endpoint + "/" + prefSet.prefs.link + "?width=" + data.width + "&height=" + data.height + "&location=" + worker.tab.url,
                            onComplete: function(response)
                            {
                                //This code brought to you by http://stackoverflow.com/a/12860340/780075
                                // Parse the HTML code into a temporary document
                                var doc = Cc["@mozilla.org/xmlextras/domparser;1"]
                                               .createInstance(Ci.nsIDOMParser)
                                               .parseFromString(response.text, "text/html");

                                // Make sure all links are absolute
                                for (var i = 0; i < doc.links.length; i++)
                                    doc.links[i].setAttribute("href", doc.links[i].href);

                                // Make sure all stylesheets are inlined
                                var stylesheets = doc.getElementsByTagName("link");
                                var stylesheetCount = stylesheets.length;
                                var cssComplete = function(sheet, index){
                                    return function(cssResponse){
                                        var style = doc.createElement("style");
                                        style.setAttribute("type", "text/css");
                                        style.textContent = cssResponse;
                                        sheet.parentNode.replaceChild(style, stylesheets[i]);
                                        if(index == stylesheetCount - 1)
                                        {
                                            // Serialize the document into a string again
                                            html = Cc["@mozilla.org/xmlextras/xmlserializer;1"]
                                                     .createInstance(Ci.nsIDOMSerializer)
                                                     .serializeToString(doc.documentElement);

                                            // Now sanizite the HTML code
                                            var parser = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
                                            var sanitizedHTML = parser.sanitize(html, parser.SanitizerAllowStyle);
                                            worker.port.emit("adResult" + data.nonce, sanitizedHTML);
                                        }
                                    };
                                };
                                if(stylesheetCount > 0)
                                {
                                    for (i = 0; i < stylesheets.length; i++)
                                    {
                                        var request = Request({
                                            url: stylesheets[i].href,
                                            onComplete: cssComplete(stylesheets[i], i)
                                        }).get();
                                    }
                                }
                                else
                                {
                                    // Serialize the document into a string again
                                    html = Cc["@mozilla.org/xmlextras/xmlserializer;1"]
                                         .createInstance(Ci.nsIDOMSerializer)
                                         .serializeToString(doc.documentElement);

                                    // Now sanizite the HTML code
                                    var parser = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
                                    var sanitizedHTML = parser.sanitize(html, parser.SanitizerAllowStyle);
                                    worker.port.emit("adResult" + data.nonce, sanitizedHTML);
                                }
                            }
                        }).get();
                    });
                }
            }
        });
        
    }
}).get();

//Init list
getLinks();
