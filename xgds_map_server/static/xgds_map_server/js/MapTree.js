$(document).ready(function(){
    $("#treeDiv")
    .jstree({
	"json_data": {
	    "ajax": {
		"url": jsTreeMapTreeURL
	    },
	    "progressive_render": true,
	    "progressive_unload": false
	},
	"themes": {
	    "theme": "default",
	    "dots": true,
	    "icons": false
	},
	"plugins": ["themes", "json_data"]
    });
});
