from django.template import Library

register = Library()

@register.filter(name='multiply')
def multiply( v1, v2 ):
    return v1*v2