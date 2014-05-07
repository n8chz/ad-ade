try {
    var foo = window.parent.location.href;
    self.on('message', function(message) {
        if (message.action == 'setSelectors') {
            var AR = new AdReplacer(message.data);
            $(document).ready(function(){AR.replace();});
        }
    });
} catch(e) {
}