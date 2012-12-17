---
layout: post
title: "Use try except with care"
description: ""
category: 
tags: []
---


Today I got bitten by an issue that relates to how people use try
except blocks in python.

I see it often enough in python that its worth bring up for
discussion. Poor use of try except can cause bugs that are very hard
or almost impossible to detect.


As in most languages, python give us the ability to check for errors
at runtime and address those errors. The syntax is as follows

{% highlight python %}
    try
        # some block of code that could throw an error
    except Exception, e:
        # do something to address an error
    finally:
        # do no matter what
{% endhighlight %}

Also note that within the except statement, you can provide a class
for the specific error you want to catch. In this case the except
block will only run when the offending code throws that type of error.

Having this is important as life is unfair and application do have
errors.

This is a more of an real world example and very close to the one I
found today.


{% highlight python %}
    def django_view_func(request):
        try:
            response = get_url(request.params.url)
            return response
        except Exception, e:
            return HttpErrorResponse(
                body = e.message,
                status_code = 500
            )
{% endhighlight %}

This code makes a request to GeoServer from within a try except block,
either returning a response if everything is okay or throws a 500 if
something blows up.

There are a couple of issues with this code. The first issue is we are
catching all Exceptions. Everything, syntax errors etc. Now in this
case its not awful because the function is short. But if that function
was 200 lines long (godforbid!), anywhere in this block could be throwing an
exception and how would you know?

However, this is a solvable issue as most http client libraries are
nice enough to give specific class exceptions. In other words, can we
write the above code as

{% highlight python %}
    def django_view_func(request):
        try:
            response = get_url(request.params.url)
            return response
        except HttpError, e:
            return HttpErrorResponse(
                body = e.message,
                status_code = 500
            )
{% endhighlight %}

And this is great, because its now easier to spot whats going on. If
this except block is run, we know now that is has something to do with
an http error. Always catching on a specific exception type is
important.

But honestly, what are we doing with the except block? Seeing if there
is an http error and throw an http error. In this case I think we can
remove the try except block altogether. If there is an error, django
will detect it and throw a 500 error anyway. Even less code.

Even worse is a pattern that I sometimes see, 

{% highlight python %}
    try:
        doSomething()
    except Exception, e:
        pass
{% endhighlight %}

This is evil right? We are catching an error and not even telling
anyone that we are. An error could be thrown and how would we know?
This does not prevent the error from arising, however, as most
likely a different error will be thrown further down the stack.

Not using try except sometimes is the best policy. Let the errors
bubble up, unless you are actually going to address them.
