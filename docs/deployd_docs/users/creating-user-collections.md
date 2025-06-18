<!--{
  title: 'Creating User Collections',
  tags: ['guide', 'collection', 'users']
}-->

## Creating User Collections

### User Collection

A User Collection extends a [Collection](/docs/collections/creating-collections.md), adding the functionality needed to authenticate users with your app. You can create one by choosing "User Collection" when adding a Resource.

#### Properties

User Collections can have the same properties as a Collection, with two additional non-removable properties:

- `username` - The user's identifier; must be unique.
- `password` - An encrypted password. It can never be retrieved from the database, only queried against.

In addition to the above constraints, these two properties can only be modified by:

- A session authenticated as that user
- An internal request, such as a call from an event.
- A root request