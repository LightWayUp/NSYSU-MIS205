# Client Library
This is the client side library for easily interacting with RESTful API of the server.

## Usage
Include the script in your page:

```html
<head>
    <!-- ... -->
    <script src="/api.js"></script>
</head>
```

Then, instantiate a new `Client`:

```html
<body>
    <!-- ... -->
    <script>
        (async () => {
            const client = await Api.Client.newInstance();
            // Then do whatever you want...
        })();
    </script>
</body>
```

All of the public APIs are accessible under `window.Api`.

## API Endpoints
See [API Endpoints](../server/API_ENDPOINTS.md) for more information
about which endpoint each function requests.

## API

* [Client](#client)
* [UserProfile](#userprofile)
* [User](#user)
* [ClientUser](#clientuser)
* [Post](#post)
* [Comment](#comment)
* [JsonWebToken](#jsonwebtoken)
* [HttpError](#httperror)
* [Gender](#gender)

### A Note on Error Handling
Any function that returns a `Promise`, unless otherwise noted, has the possibility
to reject. In such cases, always attach an error handler with `.catch()`, and take
appropriate actions (such as retrying after a certain amount of time, or alerting
the user through graphical user interface) upon getting an error.

### Client
The main hub to access and interact with the API.

#### client.clientUser

* `<ClientUser>` | `<undefined>`

An instance of `ClientUser`, representing the user the `client` is logged in as.  
This is only available when the `client` is logged in, otherwise is `undefined`.

#### client.token

* `<JsonWebToken>` | `<undefined>`

An instance of `JsonWebToken` containing information of
the authentication token provided by the server.  
This is only available when an authentication token exists in
`LocalStorage` (whether expired or not), otherwise is `undefined`.

#### Client.newInstance()

* Returns: `<Promise<Client>>`

Create a `Promise` which would eventually resolve to an instance of `Client`.  
The returned `Promise` never rejects, although the client may fail to log in
due to network errors, even if the previous authentication token hasn't expired yet.

You probably want to only invoke this once on a page, as having multiple `Client`
instances still does not allow to log in as different users simultaneously.

```js
const clientPromise = Client.newInstance();
clientPromise.then(client => {
    // ...
});
```

#### client.isLoggedIn()

* Returns: `<boolean>`

Check whether `client` is "logged in".  
The function exists for convenience and clarity, and really just does this:

```js
/* method */ isLoggedIn() {
    return !!this.clientUser; // Check whether clientUser is available
}
```

#### client.register(email, password, userProfile)

* `email` `<string>`
* `password` `<string>`
* `userProfile` `<UserProfile>`
* Returns: `<Promise<User>>` | `<Promise<undefined>>`

Register for a new user, without logging in.  
If the registration is successful, but the response returned by the server is
malformed, `Promise` would resolve to `undefined` instead of an instance of `User`.

#### client.login(email, password)

* `email` `<string>`
* `password` `<string>`
* Returns: `<Promise<JsonWebToken>>`

Log the `client` in as a user.  
Note that the `Promise` still resolves even if the `client` fails to log in,
as long as a new authentication token is obtained. To guard against issues arisen
from such situation, check `client.clientUser`'s availability before using it.

```js
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");

client.login(emailInput.value, passwordInput.value)
.then(() => {
    if (client.isLoggedIn()) {
        // If client is logged in successfully, show an alert
        return alert(`You're logged in as ${client.clientUser.userProfile.getProfileName()}!`);
    }
    // Otherwise, throw an Error because
    // not too much can be done about it
    throw new Error("Failed to log in");
}).catch(error => alert(`Sorry, an error occured: ${error}`));
```

#### client.logout()
Log out the `client`.

#### client.refreshTokenConditionally([noRejectionOnFailure])

* `noRejectionOnFailure` `boolean` An optional option to suppress `Promise` rejection
* Returns: `<Promise<boolean>>`

Refresh the authentication token if it's "about to expire". The returned `Promise`
resolves to a `boolean` indicating whether the authentication token has changed.

`noRejectionOnFailure` defaults to `true`, and is an optional option to suppress
`Promise` rejection in case the authentication token can not be refreshed due to
network errors.  
Note that the `Promise` may still reject under other circumstances,
such as invoking the function with an expired authentication token.

#### client.verifyEmail(verificationCode, email)

* `verificationCode` `<string>`
* `email` `<string>`
* Returns: `<Promise<boolean>>`

Verify the account the email address is associated with.

#### client.fetchUserById(id)

* `id` `<string>`
* Returns: `<Promise<User>>`

Fetch details of a user, excluding account credentials, by its ID.

```js
const comment = getACommentSomehow();
client.fetchUserById(comment.authorId).then(user =>
    alert(`The comment is created by a user from Department of ${
        user.userProfile.department}.`), error =>
    alert(`Sorry, an error occured: ${error}`));
```

#### client.fetchUsers([page])

* `page` `<number>` The page of paginated results, defaults to `1`
* Returns: `<Promise<User[]>>`

Fetch details of all users, excluding their account credentials.  
The number of results per each page is configured
by the server, outside of client side's control.

#### client.fetchPostById(id)

* `id` `<string>`
* Returns: `<Promise<Post>>`

Fetch details of a post by its ID.

#### client.fetchPosts([page])

* `page` `<number>` The page of paginated results, defaults to `1`
* Returns: `<Promise<Post[]>>`

Fetch details of all posts.  
The number of results per each page is configured
by the server, outside of client side's control.

#### client.fetchCommentById(id, post)

* `id` `<string>`
* `post` `<Post>`
* Returns: `<Promise<Comment>>`

Fetch details of a comment by its ID and its owning post.

#### client.fetchComments(post[, page])

* `post` `<Post>`
* `page` `<number>` The page of paginated results, defaults to `1`
* Returns: `<Promise<Comment[]>>`

Fetch details of all comments of a post.  
The number of results per each page is configured
by the server, outside of client side's control.

#### client.setClientUser()

* Returns: `<Promise<ClientUser>>`

Fetch details, including account credentials, of the user whose identity
is stated in the stored authentication token payload, then construct a new
instance of `ClientUser` for use which is also accessible as `client.clientUser`.

### UserProfile
Structure to contain information of an user.

#### new UserProfile(username, displayName, gender, department)

* `username` `<string>`
* `displayName` `<string>` | `<null>` | `<undefined>` The name to be displayed in place of the real name
* `gender` `<Symbol>` One of `Gender.OTHER`, `Gender.MALE`, `Gender.FEMALE`
* `department` `<string>`

Create a new instance of `UserProfile` containing information of an user.

```js
const myProfile = new UserProfile(
    "LightWayUp",
    "Lighty",
    Gender.MALE,
    "Information Management"
);
```

#### userProfile.username

* `<string>`

The username of an user.

#### userProfile.displayName

* `<string>` | `<undefined>`

The name to be displayed in place of the real name.
This can be thought of as the user's "nickname".

#### userProfile.gender

* `<Symbol>`

One of `Gender.OTHER`, `Gender.MALE`, `Gender.FEMALE`, representing
undisclosed gender, male, and female respectively.  
For the best accessibility and inclusiveness of your service
or app, allow "other" gender to be selected, by reason of
biological differences and gender identity concerns.

#### userProfile.department

* `<string>`

The academic department of an user.

#### userProfile.getProfileName()

* Returns: `<string>`

Returns the `displayName` of `userProfile`, or its `name` if `displayName` is not set.

#### UserProfile.isGender(any)

* `any` `<any>`
* Returns: `<boolean>`

Check if `any` is one of `Gender.OTHER`, `Gender.MALE`, `Gender.FEMALE`.

#### UserProfile.getGender(genderInformation)

* `genderInformation` `<any>`
* Returns: `<Symbol>` | `<undefined>`

Get one of `Gender.OTHER`, `Gender.MALE`, `Gender.FEMALE`, depending on the value of
`genderInformation`.  
Currently, the mapping between `Gender` and `genderInformation` is as follows:

  * `Gender.OTHER` - `0`
  * `Gender.MALE` - `1`
  * `Gender.FEMALE` - `2`

If `genderInformation` is not in the mapping, this function returns `undefined`.

#### UserProfile.getGenderInformation(gender)

* `gender` `<Symbol>`
* Returns: `<number>`

The reverse process of `UserProfile.getGender()`, with the exception that
`gender` must be one of `Gender.OTHER`, `Gender.MALE`, `Gender.FEMALE`,
otherwise a `TypeError` will be thrown.

### User
Model that represents an user.

#### user.id

* `<string>`

The ID of the user account.

#### user.userProfile

* `<UserProfile>`

A structure which contains information of the user
this `user` is representing, such as name and gender.

### ClientUser

* Extends: `<User>`

Model that represents an user the client is currently logged in as,
and is capable of performing actions such as creating new posts.

#### clientUser.client

* `<Client>`

The instance of `Client` that is logged in as
the user this `clientUser` is representing.

#### clientUser.email

* `<string>`

The email address of the user.

#### clientUser.updateSelf([password])

* `password` `<string>`
* Returns: `<Promise<ClientUser>>`

Update information of the user the `clientUser` is representing.  
If `password` is provided, it'll also be updated.

```js
// Perform edits first...
const myProfile = clientUser.userProfile;
myProfile.username = "DarkWayDown";
myProfile.gender = Gender.OTHER;
// ...then ask the server to save the updated information
clientUser.updateSelf().then(
    () => alert("Successful edit!"), // On success
    error => alert(`Sorry, an error occured: ${error}`)); // On error
```

#### clientUser.createPost(title, content)

* `title` `<string>`
* `content` `<string>`
* Returns: `Promise<<Post>`

Create a new post authored by the user.

#### clientUser.createComment(content, post)

* `content` `<string>`
* `post` `<Post>`
* Returns: `<Promise<Comment>>`

Create a new comment authored by the user, for the post.

#### clientUser.updatePost(post)

* `post` `<Post>`
* Returns: `<Promise<Post>>`

Update the post title and content.

#### clientUser.updateComment(comment)

* `comment` `<Comment>`
* Returns: `<Promise<Comment>>`

Update the comment content.

#### clientUser.deletePost(post)

* `post` `<Post>`
* Returns: `<Promise<undefined>>`

Delete the post. Be careful that this would also cause all comments of the post to be
deleted on the server side, which maybe still be referenced to on the client side.

#### clientUser.deleteComment(comment)

* `comment` `<Comment>`
* Returns: `<Promise<undefined>>`

Delete the comment.

### Post
Model that represents a post.

#### post.id

* `<string>`

The ID of the post.

#### post.title

* `<string>`

The title of the post.

#### post.content

* `<string>`

The content of the post.

#### post.timestamp

* `<number>`

The Unix time, stored as a number, as the time of the creation of this post.

#### post.authorId

* `<string>`

The ID of the user who created the post.

### Comment
Model that represents a comment.

#### comment.id

* `<string>`

The ID of the comment.

#### comment.content

* `<string>`

The content of the comment.

#### comment.timestamp

* `<number>`

The Unix time, stored as a number, as the time of the creation of this comment.

#### comment.postId

* `<string>`

The ID of the post owning this comment.

#### comment.authorId

* `<string>`

The ID of the user who created the comment.

### JsonWebToken
Structure that contains partial information of a JSON Web Token; more
specifically, the authentication token itself, and its expiration time.

#### new JsonWebToken(tokenInformation)

* `tokenInformation` `<Object>`
  * `token` `<string>` The authentication token itself
  * `expiration` `<number>` The expiration time of the token as Unix time stored as a number

Create a new instance of `JsonWebToken` containing
information of an authentication token.

#### jsonWebToken.value

* `<string>`

The authentication token contained in this `jsonWebToken`.

#### jsonWebToken.expirationTime

* `<number>`

The expiration time of the authentication token, as Unix time stored as a number.

#### jsonWebToken.token

* `<string>`

An alias for `jsonWebToken.value`.

#### jsonWebToken.expiration

* `<number>`

An alias for `jsonWebToken.expirationTime`.

#### jsonWebToken.hasExpired()

* Returns: `<boolean>`

Check if the authentication token has expired.

#### jsonWebToken.willExpire([afterTime])

* `afterTime` `<number>` An optional number, being the number
of milliseconds to pass starting from now
* Returns: `<boolean>`

Check if the authentication token would have expired after passing `afterTime`
milliseconds from now. `afterTime` must be a non-negative integer, so invoking
this function with an expired authentication token would always evaluate to `true`.

`afterTime` defaults to `86400000`, the number of milliseconds in a day.

#### JsonWebToken.fromLocalStorage()

* Returns: `<JsonWebToken>` | `<undefined>`

Create a new instance of `JsonWebToken` from the information
saved in `LocalStorage`. If none exists, `undefined` is returned.

#### JsonWebToken.save([token])

* `token` `<JsonWebToken>` An instance of `JsonWebToken` whose information is to be saved
* Returns: `<JsonWebToken>` | `<undefined>`

Save the information contained in `token` to `LocalStorage`.
If `token` is not provided, all saved information of
authentication token are cleared, and `undefined` is returned.

#### JsonWebToken.watchForChanges(client)

* `client` `<Client>`

As the user could open multiple tabs or windows of your service or app,
each of which runs the same `api.js` script, they would share the same
`LocalStorage` to save authentication token information. Such situation
creates data inconsistency, where if the authentication token is refreshed
by an instance of `Client`, the other instances would still be referencing
the old token, and thus failing when performing actions that require
authentication.  
This function makes the global object (in the browser environment, the
`window`) listen to `StorageEvent`s, and update `client.token` accordingly.

#### JsonWebToken.StorageKeys

* `<Object>`
  * `TOKEN` `<string>`
  * `EXPIRATION_TIME` `<string>`

The data of the object is the following:

```js
{
    TOKEN: "token",
    EXPIRATION_TIME: "token_expiration_time"
};
```

### HttpError

* Extends: `<Error>`

Error that represents a HTTP error from a request.

#### new HttpError([message], statusCode[, url])

* `message` `<string>` An optional description of the error, usually the status
text associated with `statusCode`
* `statusCode` `<number>` The status code, which should never be `200` ~ `299`,
as those indicate successful responses
* `url` `<string>` | `<URL>` An optional URL of the request

Create a new instance of `HttpError` representing a HTTP error from a request.

#### error.message

* `<string>`

The error message.

#### error.name

* `<string>`

A name representing the type of error, which is always initially "`HttpError`".

#### error.statusCode

* `<number>`

The status code of the HTTP error.

#### error.url

* `<string>` | `<undefined>`

The URL of the request.

### Gender
The `Gender` enum.

#### Gender.OTHER

* `<Symbol>`

The constant representing undisclosed gender.

#### Gender.MALE

* `<Symbol>`

The constant representing male gender.

#### Gender.FEMALE

* `<Symbol>`

The constant representing female gender.

## Debugging
Set `DEBUG` boolean variable on the global object to enable/disable output of debug
messages. By default, only regular logs, warnings and errors are outputted to the console.
