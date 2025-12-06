package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

type Client struct {
	client   *mongo.Client
	database *mongo.Database
}

func NewClient(uri, databaseName string) (*Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, err
	}

	// Ping to verify connection
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, err
	}

	return &Client{
		client:   client,
		database: client.Database(databaseName),
	}, nil
}

func (c *Client) Database() *mongo.Database {
	return c.database
}

func (c *Client) Collection(name string) *mongo.Collection {
	return c.database.Collection(name)
}

func (c *Client) Close(ctx context.Context) error {
	return c.client.Disconnect(ctx)
}

// Collection names
const (
	CollectionWorkflows     = "workflows"
	CollectionNodeTypes     = "node_types"
	CollectionSchemas       = "schemas"
	CollectionExecutions    = "executions"
	CollectionEndpoints     = "endpoints"
	CollectionMappings      = "mappings"
	CollectionUsers         = "users"
	CollectionRoles         = "roles"
	CollectionRefreshTokens = "refresh_tokens"
	CollectionInvitations   = "invitations"
	CollectionSettings      = "settings"
)
