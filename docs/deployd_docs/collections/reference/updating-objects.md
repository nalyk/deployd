<!--{
  title: 'Updating Objects in Collections',
  tags: ['reference']
}-->

## Updating Objects in Collections

When updating an object in a Collection, you can use special modifier commands to more granularly change property values. 

### $inc <!-- api -->

The `$inc` command increments the value of a given Number property.

    // Give a player 5 points
    {
      score: {$inc: 5}
    }

### $push <!-- api -->

The `$push` command adds a value to an Array property.

    // Add a follower to a user by storing their id.
    {
      followers: {$push: 'a59551a90be9abd8'}
    }

### $pushAll <!-- api -->

The `$pushAll` command adds multiple values to an Array property.

    // Add mentions of users
    {
      mentions: {
        $pushAll: ['a59551a90be9abd8', 'd0be45d1445d3809']
      }
    }

### $pull <!-- api -->

The `$pull` command removes a value from an Array property.

    // Remove a user from followers
    {
      followers: {$pull: 'a59551a90be9abd8'}
    }

*Note: If there is more than one matching value in the Array, this will remove all of them*

### $pullAll <!-- api -->

The `$pullAll` command removes multiple values from an Array property.

    // Remove multiple users
    {
      followers: {$pullAll: ['a59551a90be9abd8', 'd0be45d1445d3809']}
    }

*Note: This will remove all of the matching values from the Array*