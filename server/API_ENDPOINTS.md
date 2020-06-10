# API Endpoints
All endpoints accept and return JSON content.

\*: Requires authentication. If unauthenticated, status will be `401 Unauthorized`.

## Client Library
If you're looking for the client side library to ease interaction with
the RESTful API of the server, see [Client Library](../client/README.md).

## Authentication Token

### Obtaining a New Token

```
POST /api/token/new
```

#### Parameters

Name | Type
--- | ---
`email` | `string`
`password` | `string`

#### Response

```
200 OK
```
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDAiLCJuYW1lIjoiRGF0YWJhc2UgTWFuYWdlbWVudCIsImlhdCI6MTU5MTIyODgwMH0.rfWNB8xVK9VIXZnf6LhUfooqzfBVy6uZ4Loc7n_Ywg0",
    "expiration": 1591228800000
}
```

### Refreshing Token\*

```
GET /api/token/refresh
```

#### Response

```
200 OK
```
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDAiLCJuYW1lIjoiRGF0YWJhc2UgTWFuYWdlbWVudCIsImlhdCI6MTU5MTIyODgwMH0.rfWNB8xVK9VIXZnf6LhUfooqzfBVy6uZ4Loc7n_Ywg0",
    "expiration": 1591228800000
}
```

## User

### Registering for a New User

```
POST /api/users/new
```

#### Parameters

Name | Type
--- | ---
`email` | `string`
`password` | `string`
`name` | `string`
`displayName` | `string` \| `null` \| -
`gender` | `number`
`department` | `string`

#### Response

```
201 Created
```
```json
{
    "id": "00000000-0000-4000-8000-000000000000",
    "name": "Database Management",
    "displayName": "Nick Doe",
    "gender": 2,
    "department": "Information Management"
}
```

### Verifying a User

```
POST /api/users/verify
```

#### Parameters

Name | Type
--- | ---
`verificationCode` | `string`
`email` | `string`

#### Response

```
200 OK
```
```json
{}
```

### Obtaining a User's Information

```
GET /api/users/:id
```

#### Response

```
200 OK
```
```json
{
    "id": "00000000-0000-4000-8000-000000000000",
    "name": "Database Management",
    "displayName": "Nick Doe",
    "gender": 2,
    "department": "Information Management"
}
```

### Obtaining All Users' Information

```
GET /api/users/all/:page
```

#### Response

```
200 OK
```
```json
[
    {
        "id": "00000000-0000-4000-8000-000000000000",
        "name": "Database Management",
        "displayName": "Nick Doe",
        "gender": 2,
        "department": "Information Management"
    }
]
```

### Obtaining User's Own Information\*

```
GET /api/users/self
```

#### Response

```
200 OK
```
```json
{
    "email": "user@example.com",
    "id": "00000000-0000-4000-8000-000000000000",
    "name": "Database Management",
    "displayName": "Nick Doe",
    "gender": 2,
    "department": "Information Management"
}
```

### Updating User's Own Information\*

```
POST /api/users/self/update
```

#### Parameters

Name | Type
--- | ---
`email` | `string`
`password` | `string` \| `null` \| -
`name` | `string`
`displayName` | `string` \| `null` \| -
`gender` | `number`
`department` | `string`

#### Response

```
200 OK
```
```json
{
    "email": "user@example.com",
    "id": "00000000-0000-4000-8000-000000000000",
    "name": "Database Management",
    "displayName": "Nick Doe",
    "gender": 2,
    "department": "Information Management"
}
```

## Post

### Creating a New Post\*

```
POST /api/posts/new
```

#### Parameters

Name | Type
--- | ---
`title` | `string`
`content` | `string`

#### Response

```
201 Created
```
```json
{
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Lorem Ipsum",
    "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "timestamp": 1591228800000,
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Obtaining a Post's Information

```
GET /api/posts/:id
```

#### Response

```
200 OK
```
```json
{
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Lorem Ipsum",
    "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "timestamp": 1591228800000,
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Updating a Post's Information\*

```
POST /api/posts/:id/update
```

#### Parameters

Name | Type
--- | ---
`title` | `string`
`content` | `string`

#### Response

```
200 OK
```
```json
{
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Lorem Ipsum",
    "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "timestamp": 1591228800000,
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Obtaining All Posts' Information

```
GET /api/posts/all/:page
```

#### Response

```
200 OK
```
```json
[
    {
        "id": "11111111-1111-4111-8111-111111111111",
        "title": "Lorem Ipsum",
        "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        "timestamp": 1591228800000,
        "authorId": "00000000-0000-4000-8000-000000000000"
    }
]
```

### Deleting a Post\*

```
DELETE /api/posts/:id
```

#### Response

```
200 OK
```
```json
{}
```

### Creating a New Comment of a Post\*

```
POST /api/posts/:postId/comments/new
```

#### Parameters

Name | Type
--- | ---
`content` | `string`

#### Response

```
201 Created
```
```json
{
    "id": "22222222-2222-4222-8222-222222222222",
    "content": "Ut enim ad minim veniam",
    "timestamp": 1591228800000,
    "postId": "11111111-1111-4111-8111-111111111111",
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Obtaining Information of a Comment of a Post

```
GET /api/posts/:postId/comments/:id
```

#### Response

```
200 OK
```
```json
{
    "id": "22222222-2222-4222-8222-222222222222",
    "content": "Ut enim ad minim veniam",
    "timestamp": 1591228800000,
    "postId": "11111111-1111-4111-8111-111111111111",
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Updating Information of a Comment of a Post\*

```
POST /api/posts/:postId/comments/:id/update
```

#### Parameters

Name | Type
--- | ---
`content` | `string`

#### Response

```
200 OK
```
```json
{
    "id": "22222222-2222-4222-8222-222222222222",
    "content": "Ut enim ad minim veniam",
    "timestamp": 1591228800000,
    "postId": "11111111-1111-4111-8111-111111111111",
    "authorId": "00000000-0000-4000-8000-000000000000"
}
```

### Obtaining Information of All Comments of a Post

```
GET /api/posts/:postId/comments/all/:page
```

#### Response

```
200 OK
```
```json
[
    {
        "id": "22222222-2222-4222-8222-222222222222",
        "content": "Ut enim ad minim veniam",
        "timestamp": 1591228800000,
        "postId": "11111111-1111-4111-8111-111111111111",
        "authorId": "00000000-0000-4000-8000-000000000000"
    }
]
```

### Deleting a Comment of a Post\*

```
DELETE /api/posts/:postId/comments/:id
```

#### Response

```
200 OK
```
```json
{}
```
