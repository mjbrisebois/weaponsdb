var fs		= require('fs');
var page	= require('webpage').create();

try {
    // https://en.wikipedia.org/wiki/List_of_firearms
    // http://localhost:8000/List_of_firearms.html
    page.open('https://en.wikipedia.org/wiki/List_of_firearms', function(status) {
	var d = page.evaluate(function() {
	    function nodeInfo(e) {
		var name,links,extra;
		var $e		= $(e);
		var text	= $e.text();

		extra		= $e.clone().children().remove().end().text();
		name		= text.split(' (')[0];
		
		var $a		= $e.find('> a');
		if ($a.length) {
		    links	= [];
		    $a.each(function() {
			links.push( $(this).attr('href') );
		    });
		}
		
		return {
		    "name": name,
		    "wikipedia_links": links,
		    "extra": extra,
		};
	    }

	    function getGuns(e, cat) {
		var guns	= [];
		var $guns	= $('> ul > li', e);
		$guns.each(function(i) {
		    var g	= nodeInfo(this);
		    g.category	= cat;
		    g.mods	= getGuns(this);
		    guns.push(g);
		});
		return guns;
	    }
	    
	    var manufacturers	= [];
	    var $manufacturers	= $('#mw-content-text > ul > li');

	    $manufacturers.each(function(i) {
		var m		= nodeInfo(this);
		var $cats	= $('> ul > li', this);
		$cats.each(function(i) {
		    var cat	= nodeInfo(this).name;
		    m.firearms	= getGuns(this, cat);
		});
		manufacturers.push(m);
	    });
	    
	    return {
		"mlength": $manufacturers.length,
		"manufacturers": manufacturers,
	    };
	});

	if (!d.manufacturers) console.log(d);
	
	var fmJSON		= JSON.stringify(d,null,4);
	fs.write("./firearms.json", fmJSON, 'w');
	
	phantom.exit();
    });
} catch (e) {
    console.log(e);
}
