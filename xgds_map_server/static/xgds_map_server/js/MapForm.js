$(document).ready(function(){
    function toggleKMLocalFile() {
	if ($("input[name='typeChooser'][value='kml']").is(":checked")) {
	    $("#kmlFile_div").show();
	    $("#id_localFile").val('');
	    $("#localFile_div").hide();
	} else if ($("input[name='typeChooser'][value='file']").is(":checked")) {
	    $("#kmlFile_div").hide();
	    $("#localFile_div").show();
	}
    }

    $("input[name='typeChooser']").change(toggleKMLocalFile);
    toggleKMLocalFile();
});
