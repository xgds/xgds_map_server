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
	    "icons": true,
	},
	"dnd": {
	    "drop_target": false,
	    "drag_target": true,
	    "drag_check": function (data) {
		console.log(data);
		return false;
	    }
	},
	"plugins": ["themes", "json_data", "dnd"]
    });
});
