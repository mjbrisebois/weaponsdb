var fs		= require('fs');
var Py		= require('pythonify');

var text	= fs.readFileSync('./firearms.json');
var data	= JSON.parse(text);

var sepRE	= /, | \/ /;
function parseAmmo(s) {
    // Expected format
    //   9×19mm Parabellum, 12 Gauge
    // or sometimes a slash is used instead of a comma
    //   9×19mm Parabellum / 12 Gauge
    var cals		= s.split(sepRE).map(function(a) {
	return a.trim();
    });

    return cals;
}

function parseType(s) {
    // Expected format
    //   Battle Rifle / Light Machine Gun
    return s.split(sepRE);
}

// 
// Year || 'Unknown Date'
//
function year(y) {
    if (y.toLowerCase() === 'unknown date')
	return null;
    else if (isNaN(y))
	return false;
    else if (0 < parseInt(y) <= (new Date()).getFullYear())
	return parseInt(y);
    else {
	console.log('Uncaught year format', y);
	return false;
    }
}

function parseExtra(s) {
    // Expected format
    //   ALFA-PROJ Model 9241 (Czech Republic - ALFA-PROJ - Unknown Date - Double-Action Revolver - 9×19mm Parabellum: Full-length model of...)
    //   Name		       Regime		Company	    Year	   Type			    Ammunition	       Details
    var s		= Py(s.trim()).strip('/()');
    var z		= Py(s).split(': ', 1);
    var segs		= z[0].split(' - ');
    var d		= {
	"info": z[1]
    };
    switch(segs.length) {
    case 5:
	// 5 piece (Regime - Manufacturer - Year - Type - Ammo)
	d.regime	= segs[0];
    	d.yearStr	= segs[2];
	d.year		= year(segs[2]);
	d.type		= parseType(segs[3]);
	d.ammunition	= parseAmmo(segs[4]);
	break;
    case 4:
	// 4 piece (Regime - Year - Type - Ammo)
	// 4 piece (Regime - Type - Year - Ammo)
	d.regime	= segs[0];
	if (isNaN(segs[2])) {
    	    d.yearStr	= segs[1];
	    d.year	= year(segs[1]);
	    d.type	= parseType(segs[2]);
	}
	else if (isNaN(segs[1])) {
    	    d.yearStr	= segs[2];
	    d.year	= year(segs[2]);
	    d.type	= parseType(segs[1]);
	}
	else
	    console.log('Unknown format caught by year', s.length, s);
	d.ammunition	= parseAmmo(segs[3]);
	break;
    case 3:
	// 3 piece (Regime - Type - Ammo)
	d.regime	= segs[0];
	d.year		= null;
	d.type		= parseType(segs[1]);
	d.ammunition	= parseAmmo(segs[2]);
	break;
    case 2:
    	// 2 piece (Regime - Type)
    	d.regime	= segs[0];
    	d.year		= null;
    	d.type		= parseType(segs[1]);
    	d.ammunition	= [];
    	break;
    default:
	// unknown
	// console.log('Unknown format for extra string', s.length, s);
	d		= false;
	break;
    }
    return d;
}

function parseFirearm(f) {
    // We don't want multiline names
    f.name		= f.name && f.name.split('\n')[0].trim();
    f.category		= f.category && f.category.trim();

    // Prefix links with the wikipedia domain
    if (f.wikipedia_links) {
	f.wikipedia_links.forEach(function(l, i) {
	    f.wikipedia_links[i]	= "https://en.wikipedia.org" + l;
	});
    }

    if (f.extra && f.extra.trim()) {
	var extra	= parseExtra(f.extra);
	if (extra === false)
	    console.log('Unknown format for extra string', f.name, f.extra);
	else
	    Py(f).update(extra);
    }

    // Original is a better discriptor for the extra information
    // now that it has been disected.
    if (f.extra && f.extra.trim())
	f.original	= f.extra;
    delete f.extra;
    
    if (f.mods) {
	f.mods.forEach(function(f) {
	    parseFirearm(f);
	});
    }
}

data.manufacturers.forEach(function(m) {
    // If it has valid extra data is probably a firearm
    if (m.extra && Py(m.extra.trim()).strip('/()') && !Py(m.name).startsWith(m.extra))
	parseFirearm(m);
    else {
	// Manufacturer names get messed up because they don't have
	// extra data.  We fix this by taking the first line of
	// information as the manufacturer name.
	m.name		= m.name.split('\n')[0].trim();
	
	// Prefix links with the wikipedia domain
	if (m.wikipedia_links) {
	    m.wikipedia_links.forEach(function(l, i) {
		m.wikipedia_links[i]	= "https://en.wikipedia.org" + l;
	    });
	}

	// Original is a better discriptor for the extra information
	// now that it has been disected.
	// if (m.extra && m.extra.trim())
	//     m.original	= m.extra;
	delete m.extra;
    }
    
    if (m.firearms) {
	m.firearms.forEach(function(f) {
	    parseFirearm(f);
	});
    }
});

var fmJSON		= JSON.stringify(data,null,4);
fs.writeFileSync("./detailed_firearms.json", fmJSON);
