var fs		= require('fs');
var page	= require('webpage').create();

try {
    // https://en.wikipedia.org/wiki/List_of_firearms
    // http://localhost:8000/List_of_firearms.html
    page.open('https://en.wikipedia.org/wiki/List_of_firearms', function(status) {
	var d = page.evaluate(function() {
	    function nodeInfo(e) {
		// Expected format
		//   ALFA-PROJ Model 9241 (Czech Republic - ALFA-PROJ - Unknown Date - Double-Action Revolver - 9×19mm Parabellum: Full-length model of...)
		//   Name		  (Extra													  )
		
		var name,links,extra;
		var $e		= $(e);

		// The <li> element can contain any number of sub-element including the <ul> list of
		// variants.  We need to isolate the text that belongs to the current firearm by
		// removing the child elements.
		extra		= $e.clone().children().remove().end().text();

		// Usually the name is wrapped in <a> tags and sometime split into multiple tags.
		// Those would be removed from the extra data so we must isolate it differently.
		var text	= $e.text();
		name		= text.split(' (')[0];

		// Gather all the links found in the current firearm data
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
		    g.mods	= getGuns(this, cat);
		    guns.push(g);
		});
		return guns;
	    }
	    
	    var manufacturers	= [];
	    var $manufacturers	= $('#mw-content-text > ul > li');

	    // Expected HTML hierarchy
	    // #mw-content-text
	    //     ul > li:		Manufacturer (sometimes is a firearm with no sub-list)
	    //         ul > li:		Type
	    //             ul > li:	Firearm
	    $manufacturers.each(function(i) {
		var m		= nodeInfo(this);
		m.firearms	= [];
		var $cats	= $('> ul > li', this);
		$cats.each(function(i) {
		    // If a category has an <a> tag then it is actually a weapon
		    if ($('> a', this).length)
			return;
		    
		    var cat	= $(this).clone().children().remove().end().text();
		    $.merge(m.firearms, getGuns(this, cat));
		});

		// If no firearms were found it might be because they are not separated by
		// categories.
		if (m.firearms.length === 0)
		    m.mods	= getGuns(this);
		
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
