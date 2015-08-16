var failNumber = 0;
When(/^set fail number to (\d+)$/,function(strNum){
	failNumber = num(strNum);
});
Given(/^counted fail$/, function(){
	if(failNumber > 0) failNumber--;
	else return false;
});
When(/^counted fail$/, function(){
	if(failNumber > 0) failNumber--;
	else return false;
});
Then(/^counted fail$/, function(){
	if(failNumber > 0) failNumber--;
	else return false;
});