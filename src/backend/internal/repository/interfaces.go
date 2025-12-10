package repository

import (
	"context"

	"github.com/nodetl/nodetl/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// WorkflowRepository defines the interface for workflow data operations
type WorkflowRepository interface {
	Create(ctx context.Context, workflow *domain.Workflow) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Workflow, error)
	GetAll(ctx context.Context, filter WorkflowFilter) ([]domain.Workflow, int64, error)
	Update(ctx context.Context, workflow *domain.Workflow) error
	PartialUpdate(ctx context.Context, id primitive.ObjectID, updates map[string]interface{}) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	GetByEndpointPath(ctx context.Context, path string) (*domain.Workflow, error)
	CheckEndpointExists(ctx context.Context, path string, excludeWorkflowID *primitive.ObjectID) (bool, error)
}

type WorkflowFilter struct {
	Status    *domain.WorkflowStatus
	Name      *string
	ProjectID *string
	Page      int
	PageSize  int
}

// SchemaRepository defines the interface for schema data operations
type SchemaRepository interface {
	Create(ctx context.Context, schema *domain.Schema) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Schema, error)
	GetAll(ctx context.Context, filter SchemaFilter) ([]domain.Schema, int64, error)
	Update(ctx context.Context, schema *domain.Schema) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	GetByName(ctx context.Context, name string) (*domain.Schema, error)
	SeedPredefined(ctx context.Context) error
}

type SchemaFilter struct {
	Type     *domain.SchemaType
	Category *string
	Name     *string
	Page     int
	PageSize int
}

// NodeTypeRepository defines the interface for node type data operations
type NodeTypeRepository interface {
	Create(ctx context.Context, nodeType *domain.NodeType) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.NodeType, error)
	GetByType(ctx context.Context, typeName string) (*domain.NodeType, error)
	GetAll(ctx context.Context, filter NodeTypeFilter) ([]domain.NodeType, error)
	Update(ctx context.Context, nodeType *domain.NodeType) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	SeedBuiltIn(ctx context.Context) error
}

type NodeTypeFilter struct {
	Category  *string
	IsBuiltIn *bool
}

// ExecutionRepository defines the interface for execution data operations
type ExecutionRepository interface {
	Create(ctx context.Context, execution *domain.Execution) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.Execution, error)
	GetByWorkflowID(ctx context.Context, workflowID primitive.ObjectID, page, pageSize int) ([]domain.Execution, int64, error)
	GetByWorkflowIDs(ctx context.Context, workflowIDs []primitive.ObjectID, page, pageSize int) ([]domain.Execution, int64, error)
	Update(ctx context.Context, execution *domain.Execution) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	GetLatest(ctx context.Context, workflowID primitive.ObjectID, limit int) ([]domain.Execution, error)
}

// MappingRepository defines the interface for field mapping data operations
type MappingRepository interface {
	Create(ctx context.Context, mapping *domain.FieldMapping) error
	GetByID(ctx context.Context, id primitive.ObjectID) (*domain.FieldMapping, error)
	GetBySchemas(ctx context.Context, sourceID, targetID primitive.ObjectID) (*domain.FieldMapping, error)
	GetAll(ctx context.Context, page, pageSize int) ([]domain.FieldMapping, int64, error)
	Update(ctx context.Context, mapping *domain.FieldMapping) error
	Delete(ctx context.Context, id primitive.ObjectID) error
}
