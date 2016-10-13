var fs		= require('fs');
var Py		= require('pythonify');

var text	= fs.readFileSync('./firearms.json');
var data	= JSON.parse(text);

function parseAmmo(s) {
    var z		= Py(s).split(': ', 1);
    var cals		= z[0].split(', ').map(function(a) {
	return a.trim();
    });
    return {
	"info": z[1],
	"calibers": cals,
    };
}

// 
// Year || 'Unknown Date'
//
function year(y) {
    if (y.toLowerCase() === 'unknown date')
	return null;
    else if (1600 < parseInt(y) < 2017)
	return y;
    else {
	console.log('Unknown year format', y);
	return null;
    }
}

function parseExtra(s) {
    var d		= {};
    var segs		= Py(s.trim()).strip('/ ()').split(' - ');
    switch(segs.length) {
    case 5:
	// 5 (Country - Manufacturer - Year - Type - Ammo: extra ammo info)
	d.country	= segs[0];
	d.year		= year(segs[2]);
	d.type		= segs[3];
	d.ammunition	= parseAmmo(segs[4]);
	break;
    case 4:
	// 4 (Country - Year - Type - Ammo: extra ammo info)
	d.country	= segs[0];
	d.year		= year(segs[1]);
	d.type		= segs[2];
	d.ammunition	= parseAmmo(segs[3]);
	break;
    case 3:
	// 3 (Country - Type - Ammo, Ammo: extra ammo info)
	d.country	= segs[0];
	d.year		= null;
	d.type		= segs[1];
	d.ammunition	= parseAmmo(segs[2]);
	break;
    case 2:
    	// 2 (Country - Type)
    	d.country	= segs[0];
    	d.year		= null;
    	d.type		= segs[1];
    	d.ammunition	= [];
    	break;
    default:
	// unknown
	console.log('Unknown format for extra string', s.length, s);
	break;
    }
    return d;
}

function parseFirearm(f) {
    f.name		= f.name && f.name.trim();
    f.cateogry		= f.category && f.category.trim();
    f.wikipedia_link	= f.wikipedia_link && ("https://en.wikipedia.org" + f.wikipedia_link);

    if (f.extra === '') {
	var z		= Py(f.name).split(' (', 1);
	f.name		= z[0];
	f.extra		= z[1];
    }
	
    if (f.extra && f.extra.trim()) {
	var extra	= parseExtra(f.extra);
	Py(f).update(extra);
    }
    
    if (f.mods) {
	f.mods.forEach(function(f) {
	    parseFirearm(f);
	});
    }
}

data.manufacturers.forEach(function(m) {
    if (m.firearms) {
	m.firearms.forEach(function(f) {
	    parseFirearm(f);
	});
    }
});

var fmJSON		= JSON.stringify(data,null,4);
fs.writeFileSync("./detailed_firearms.json", fmJSON);
