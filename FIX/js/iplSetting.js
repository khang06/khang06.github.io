<!--
/*---------------------------------------------------------------------------*
  Name:         MM_moveCheckImage

  Description:  選択された赤いボタンを動かす

  Arguments:    n 光るボタン番号

  Returns:      none
*---------------------------------------------------------------------------*/
function _moveCheckImageExe(m,n) {
	st = new Array("List01Check","List02Check","List03Check","List04Check","List05Check","List06Check");
	if( m >= 3 )
	{
		for( i = 0; i < m; i++ )
		{
			if( n == i )
			{
				document.all(st[i]).style.visibility="visible";
			}
			else
			{
			  	document.all(st[i]).style.visibility="hidden";
			}
		}
	}
	else if( m == 2 )
	{
		if( n == 0 )
		{
			document.all(st[1]).style.visibility="visible";
	  		document.all(st[0]).style.visibility="hidden";
		}
		else
		{
			document.all(st[0]).style.visibility="visible";
	  		document.all(st[1]).style.visibility="hidden";
		}

	}
}

function _moveCheckImage1Exe(m,n) {
	st = new Array("List01Check","List02Check","List03Check","List04Check");
	mask = "SSIDMask"
	if( m == 2 )
	{
		if( n == 1 )
		{
			document.all(st[1]).style.visibility="visible";
	  		document.all(st[0]).style.visibility="hidden";
	  		document.all(mask).style.visibility="hidden";
		}
		else
		{
			document.all(st[0]).style.visibility="visible";
	  		document.all(st[1]).style.visibility="hidden";
			document.all(mask).style.visibility="visible";
		}

	}
}

function _moveRevCheckImageExe(m,n)
{
	st = new Array("List01Check","List02Check","List03Check");
	for( i = m-1; i >= 0; i-- )
	{
		if( m-1-n == i )
		{
			document.all(st[i]).style.visibility="visible";
		}
		else
		{
		  	document.all(st[i]).style.visibility="hidden";
		}
	}
}

function _moveRankImageExe(n)
{
	st = new Array("Rank01","Rank02","Rank03","Rank04","Rank05");
	for( i = 0; i < 5; i++ )
	{
		if( n -1 == i )
		{
			document.all(st[i]).style.visibility="visible";
		}
		else
		{
		  	document.all(st[i]).style.visibility="hidden";
		}
	}
}
// -->
