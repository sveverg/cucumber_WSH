Given(/^failed step$/, function(){
	return false;
});
Given(/^step$/, function(){

});
When(/^failed step$/, function(){
	return false;
});
When(/^print$/, function(mes){
	if(mes) alert("        Message: "+mes);
});
When(/^printline"(.+)"$/,function(str){
	alert('        Line: '+str);
});
When(/^step$/,function(){

});
Then(/^failed step$/,function(){
	return false;
});
Then(/^step$/,function(){

});
