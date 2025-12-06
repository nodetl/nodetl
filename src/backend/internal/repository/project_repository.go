package repository

import (
	"context"
	"math"
	"time"

	"github.com/nodetl/nodetl/internal/domain"
	"github.com/nodetl/nodetl/pkg/mongodb"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ProjectRepository struct {
	collection *mongo.Collection
}

func NewProjectRepository(client *mongodb.Client) *ProjectRepository {
	return &ProjectRepository{
		collection: client.Collection("projects"),
	}
}

// ProjectFilter contains filter options for listing projects
type ProjectFilter struct {
	Search   string
	Status   string
	Page     int
	PageSize int
}

// Create creates a new project
func (r *ProjectRepository) Create(ctx context.Context, project *domain.Project) error {
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()
	if project.Workflows == nil {
		project.Workflows = []domain.Workflow{}
	}

	result, err := r.collection.InsertOne(ctx, project)
	if err != nil {
		return err
	}

	project.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetByID retrieves a project by ID with all workflows
func (r *ProjectRepository) GetByID(ctx context.Context, id string) (*domain.Project, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var project domain.Project
	err = r.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&project)
	if err != nil {
		return nil, err
	}

	return &project, nil
}

// List retrieves projects with pagination
func (r *ProjectRepository) List(ctx context.Context, filter ProjectFilter) (*domain.ProjectListResponse, error) {
	// Set defaults
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 {
		filter.PageSize = 10
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	// Build query
	query := bson.M{}
	if filter.Search != "" {
		query["$or"] = []bson.M{
			{"name": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"description": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"version_tag": bson.M{"$regex": filter.Search, "$options": "i"}},
		}
	}
	if filter.Status != "" {
		query["status"] = filter.Status
	}

	// Get total count
	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, err
	}

	// Calculate pagination
	skip := int64((filter.Page - 1) * filter.PageSize)
	totalPages := int(math.Ceil(float64(total) / float64(filter.PageSize)))

	// Use aggregation to get workflow count without returning all workflows
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: query}},
		{{Key: "$sort", Value: bson.D{{Key: "updated_at", Value: -1}}}},
		{{Key: "$skip", Value: skip}},
		{{Key: "$limit", Value: filter.PageSize}},
		{{Key: "$project", Value: bson.M{
			"_id":            1,
			"name":           1,
			"description":    1,
			"version_tag":    1,
			"path_prefix":    1,
			"status":         1,
			"created_at":     1,
			"updated_at":     1,
			"created_by":     1,
			"workflow_count": bson.M{"$size": bson.M{"$ifNull": []interface{}{"$workflows", []interface{}{}}}},
		}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var items []domain.ProjectListItem
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}

	if items == nil {
		items = []domain.ProjectListItem{}
	}

	return &domain.ProjectListResponse{
		Data:       items,
		Total:      total,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	}, nil
}

// Update updates an existing project (metadata only, not workflows)
func (r *ProjectRepository) Update(ctx context.Context, id string, project *domain.Project) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	project.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"name":        project.Name,
			"description": project.Description,
			"version_tag": project.VersionTag,
			"status":      project.Status,
			"updated_at":  project.UpdatedAt,
		},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
	return err
}

// Delete deletes a project by ID
func (r *ProjectRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	_, err = r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	return err
}

// AddWorkflow adds a workflow to a project
func (r *ProjectRepository) AddWorkflow(ctx context.Context, projectID string, workflow *domain.Workflow) error {
	objectID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return err
	}

	workflow.ID = primitive.NewObjectID()
	workflow.CreatedAt = time.Now()
	workflow.UpdatedAt = time.Now()

	update := bson.M{
		"$push": bson.M{"workflows": workflow},
		"$set":  bson.M{"updated_at": time.Now()},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, update)
	return err
}

// UpdateWorkflow updates a workflow within a project
func (r *ProjectRepository) UpdateWorkflow(ctx context.Context, projectID string, workflowID string, workflow *domain.Workflow) error {
	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return err
	}

	workflowObjID, err := primitive.ObjectIDFromHex(workflowID)
	if err != nil {
		return err
	}

	workflow.UpdatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"workflows.$[wf].name":        workflow.Name,
			"workflows.$[wf].description": workflow.Description,
			"workflows.$[wf].status":      workflow.Status,
			"workflows.$[wf].nodes":       workflow.Nodes,
			"workflows.$[wf].edges":       workflow.Edges,
			"workflows.$[wf].endpoint":    workflow.Endpoint,
			"workflows.$[wf].settings":    workflow.Settings,
			"workflows.$[wf].variables":   workflow.Variables,
			"workflows.$[wf].updated_at":  workflow.UpdatedAt,
			"updated_at":                  time.Now(),
		},
	}

	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{bson.M{"wf._id": workflowObjID}},
	})

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": projectObjID}, update, arrayFilters)
	return err
}

// DeleteWorkflow removes a workflow from a project
func (r *ProjectRepository) DeleteWorkflow(ctx context.Context, projectID string, workflowID string) error {
	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return err
	}

	workflowObjID, err := primitive.ObjectIDFromHex(workflowID)
	if err != nil {
		return err
	}

	update := bson.M{
		"$pull": bson.M{"workflows": bson.M{"_id": workflowObjID}},
		"$set":  bson.M{"updated_at": time.Now()},
	}

	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": projectObjID}, update)
	return err
}

// GetWorkflow retrieves a specific workflow from a project
func (r *ProjectRepository) GetWorkflow(ctx context.Context, projectID string, workflowID string) (*domain.Workflow, error) {
	project, err := r.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}

	workflowObjID, err := primitive.ObjectIDFromHex(workflowID)
	if err != nil {
		return nil, err
	}

	for _, wf := range project.Workflows {
		if wf.ID == workflowObjID {
			return &wf, nil
		}
	}

	return nil, mongo.ErrNoDocuments
}

// GetDefaultProject retrieves the default project (by name "Default")
func (r *ProjectRepository) GetDefaultProject(ctx context.Context) (*domain.Project, error) {
	var project domain.Project
	err := r.collection.FindOne(ctx, bson.M{"name": "Default"}).Decode(&project)
	if err != nil {
		return nil, err
	}
	return &project, nil
}

// SeedDefaultProject creates the default project if it doesn't exist
func (r *ProjectRepository) SeedDefaultProject(ctx context.Context) error {
	// Check if default project exists
	_, err := r.GetDefaultProject(ctx)
	if err == nil {
		// Default project already exists
		return nil
	}
	if err != mongo.ErrNoDocuments {
		return err
	}

	// Create default project
	defaultProject := &domain.Project{
		Name:        "Default",
		Description: "Default project for all workflows",
		VersionTag:  "1.0.0",
		PathPrefix:  "/api/default/1.0.0",
		Status:      domain.ProjectStatusActive,
		Workflows:   []domain.Workflow{},
	}

	return r.Create(ctx, defaultProject)
}
