var AdReplacer = (function() {
    var selectors = [];
    var nonces = [];
    
    function AdReplacer(theSelectors) {
        selectors = theSelectors;
        this.$replTemplate = $('<div class="ad-ade-repl"></div>');
    }
    
    
    AdReplacer.prototype.replace = function() {
        var rep = this;
        selectors.forEach(function(selector) {
            var $elements = $(selector);
            if ($elements.length) {
                $elements.each(function(i, element) {
                    var $element = $(element);
                    var $repl = rep.$replTemplate.clone(true);
                    var width = $element.width();
                    var height = $element.height();
                    $repl.attr('title', selector);
                    $repl.css({
                        position: $element.css('position'),
                        left: $element.css('left'),
                        top: $element.css('top'),
                        width: width + 'px',
                        height: height + 'px',
                        float: $element.css('float'),
                        zIndex: $element.css('z-index')
                    });

                    $element.parents('a').click(function(){return false;});

                    var nonce = Math.floor(Math.random() * 100000);

                    self.port.on("adResult" + nonce, function(data){
                        $repl.html(data);
                        $element.replaceWith($repl);

                        setTimeout(function($repl) {
                            return function() { $repl.css('opacity', 1); };
                        }($repl), 1);
                    });

                    self.port.emit("adRequest",{"nonce": nonce, "width": width, "height": height});
                    
                });
            }
        });
        
    };
    
    return AdReplacer;
})();